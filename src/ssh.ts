import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";
import * as command from "@pulumi/command";

/**
 * SSH Key module: Generates an ED25519 key pair and registers it with Hetzner.
 * The private key is stored as a Pulumi secret for remote access.
 */

const stack = pulumi.getStack();

// Generate an SSH key pair locally
const keyPair = new command.local.Command("generate-ssh-key", {
    create: `
        mkdir -p /tmp/nexus-ssh
        ssh-keygen -t ed25519 -f /tmp/nexus-ssh/id_ed25519 -N "" -C "nexus-${stack}@pulumi" -q
        echo "$(cat /tmp/nexus-ssh/id_ed25519.pub)|||$(cat /tmp/nexus-ssh/id_ed25519)"
        rm -rf /tmp/nexus-ssh
    `,
});

export const publicKey = keyPair.stdout.apply((out) => out.split("|||")[0].trim());
export const privateKey = pulumi.secret(
    keyPair.stdout.apply((out) => out.split("|||")[1].trim()),
);

// Register the public key with Hetzner
export const sshKey = new hcloud.SshKey("nexus-ssh-key", {
    publicKey: publicKey,
    labels: { project: "nexus", environment: stack },
});
