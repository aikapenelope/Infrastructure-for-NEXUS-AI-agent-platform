import * as pulumi from "@pulumi/pulumi";

// ---------------------------------------------------------------------------
// Module imports - each module creates its own resources
// ---------------------------------------------------------------------------

import { network, subnet } from "./src/network";
import { sshKey, publicKey, privateKey } from "./src/ssh";
import { nexusServer, nexusServerNetwork } from "./src/server";

// ---------------------------------------------------------------------------
// Network outputs
// ---------------------------------------------------------------------------

export const networkInfo = {
    id: network.id,
    subnetRange: subnet.ipRange,
};

// ---------------------------------------------------------------------------
// Server outputs
// ---------------------------------------------------------------------------

export const nexusServerIp = nexusServer.ipv4Address;
export const nexusPrivateIp = nexusServerNetwork.ip;

// ---------------------------------------------------------------------------
// SSH access (dev mode - direct public SSH)
// ---------------------------------------------------------------------------

export const sshPrivateKey = privateKey;

// ---------------------------------------------------------------------------
// Post-deploy instructions
// ---------------------------------------------------------------------------

export const nextSteps = pulumi.interpolate`
=== NEXUS AI Agent Platform - Infrastructure Deployed ===

1. Wait ~5 min for cloud-init to finish (Docker install, etc.)

2. SSH into the server:
   ssh -i <private-key-file> root@${nexusServer.ipv4Address}

3. Verify Docker is running:
   docker --version && docker compose version

4. Private network IP: ${nexusServerNetwork.ip}

5. App directories created at /opt/nexus/

6. Next: Deploy NEXUS app stack via Docker Compose
   - NEXUS API (FastAPI)     :8000
   - PostgreSQL + pgvector   :5432
   - Redis                   :6379
   - n8n                     :5678
   - Neo4j (Graphiti)        :7474/:7687
   - Langfuse                :3000
   - Prefect                 :4200
`;
