#!/bin/bash

# Generate a new keypair for the program ID
KEYPAIR_PATH="new_program_id.json"
TARGET_KEYPAIR_PATH="target/deploy/amm-keypair.json"
solana-keygen new --outfile $KEYPAIR_PATH --no-bip39-passphrase --force

#solana-keygen pubkey target/deploy/amm-keypair.json 

cp $KEYPAIR_PATH $TARGET_KEYPAIR_PATH