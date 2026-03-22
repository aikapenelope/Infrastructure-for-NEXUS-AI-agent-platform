import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";

/**
 * Network module: Creates a private network, subnet, and firewall
 * for the NEXUS AI agent platform VPS.
 *
 * DEV MODE: Firewall is open for development. SSH (22), HTTP (80),
 * HTTPS (443), and app ports are publicly accessible.
 * TODO: Lock down with Tailscale-only access before production.
 *
 * Network layout:
 *   10.1.0.0/16  - NEXUS network (separate from platform-infra 10.0.0.0/16)
 *   10.1.1.0/24  - Subnet
 *     10.1.1.10  - NEXUS server
 */

const stack = pulumi.getStack();

// ---------------------------------------------------------------------------
// Private Network
// ---------------------------------------------------------------------------

export const network = new hcloud.Network("nexus-network", {
    ipRange: "10.1.0.0/16",
    labels: { project: "nexus", environment: stack },
});

export const subnet = new hcloud.NetworkSubnet("nexus-subnet", {
    networkId: network.id.apply((id) => parseInt(id, 10)),
    type: "cloud",
    networkZone: "eu-central",
    ipRange: "10.1.1.0/24",
});

// ---------------------------------------------------------------------------
// Firewall: DEV mode - open for development access
// TODO: Replace with Tailscale-only firewall before production
// ---------------------------------------------------------------------------

export const serverFirewall = new hcloud.Firewall("fw-nexus-dev", {
    labels: { project: "nexus", environment: stack, mode: "locked" },
    rules: [
        {
            direction: "in",
            protocol: "tcp",
            port: "22",
            sourceIps: ["0.0.0.0/0", "::/0"],
            description: "SSH",
        },
        {
            direction: "in",
            protocol: "icmp",
            sourceIps: ["0.0.0.0/0", "::/0"],
            description: "Ping",
        },
    ],
});
