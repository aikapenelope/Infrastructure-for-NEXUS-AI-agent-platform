import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";

import { network, subnet, serverFirewall } from "./network";
import { sshKey } from "./ssh";

/**
 * NEXUS Server: Dedicated VPS for the AI agent platform.
 * - Hetzner CX43 (8 vCPU, 16GB RAM, 160GB disk) ~$10/mo
 * - Docker CE + Docker Compose for container orchestration
 * - 4GB swap, sysctl tuned for many containers
 * - Docker log rotation configured
 * - NO Tailscale, NO hardening — open for dev access
 * - TODO: Lock down with Tailscale before production
 */

const config = new pulumi.Config();
const stack = pulumi.getStack();
const location = config.get("location") || "hel1";

// ---------------------------------------------------------------------------
// Cloud-init: Bootstrap the NEXUS server
// ---------------------------------------------------------------------------

const cloudInit = `#cloud-config
package_update: true
package_upgrade: true

packages:
  - curl
  - htop
  - git
  - jq
  - unzip

write_files:
  - path: /etc/docker/daemon.json
    content: |
      {
        "log-driver": "json-file",
        "log-opts": {
          "max-size": "10m",
          "max-file": "3"
        },
        "default-address-pools": [
          {"base":"172.20.0.0/14","size":24}
        ],
        "bip": "172.17.0.1/16"
      }
  - path: /etc/sysctl.d/99-nexus.conf
    content: |
      net.core.somaxconn = 65535
      net.ipv4.tcp_max_syn_backlog = 65535
      net.ipv4.ip_local_port_range = 1024 65535
      net.ipv4.tcp_tw_reuse = 1
      vm.swappiness = 10
      vm.overcommit_memory = 1
      fs.inotify.max_user_watches = 524288
      fs.inotify.max_user_instances = 512

runcmd:
  # Swap (4GB for 16GB RAM server)
  - fallocate -l 4G /swapfile
  - chmod 600 /swapfile
  - mkswap /swapfile
  - swapon /swapfile
  - echo '/swapfile none swap sw 0 0' >> /etc/fstab

  # Sysctl tuning
  - sysctl --system

  # Install Docker CE
  - curl -fsSL https://get.docker.com | sh

  # Enable and start Docker
  - systemctl enable docker
  - systemctl start docker

  # Install Docker Compose plugin (latest v2)
  - mkdir -p /usr/local/lib/docker/cli-plugins
  - curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose
  - chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

  # Create app directory structure
  - mkdir -p /opt/nexus/{data,config,logs}
  - mkdir -p /opt/nexus/data/{postgres,redis,neo4j,minio,n8n,langfuse,prefect}

  # Signal cloud-init complete
  - touch /opt/nexus/.cloud-init-complete
`;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export const nexusServer = new hcloud.Server("nexus-server", {
    serverType: "cx43",
    image: "ubuntu-24.04",
    location: location,
    sshKeys: [sshKey.id],
    firewallIds: [serverFirewall.id.apply((id) => parseInt(id, 10))],
    userData: cloudInit,
    backups: true,
    deleteProtection: true,
    rebuildProtection: true,
    labels: {
        role: "nexus",
        project: "nexus",
        environment: stack,
    },
    publicNets: [
        {
            ipv4Enabled: true,
            ipv6Enabled: true,
        },
    ],
}, {
    // cloud-init only runs on first boot; changes should not replace the server.
    ignoreChanges: ["userData"],
    protect: true,
});

// Attach to private network
export const nexusServerNetwork = new hcloud.ServerNetwork("nexus-server-net", {
    serverId: nexusServer.id.apply((id) => parseInt(id, 10)),
    subnetId: subnet.id,
    ip: "10.1.1.10",
}, { dependsOn: [subnet] });
