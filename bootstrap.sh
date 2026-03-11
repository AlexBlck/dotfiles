#!/bin/sh
# ABOUTME: Entry point for bootstrapping dotfiles on a fresh machine.
# ABOUTME: Clones the repo to ~/.dotfiles and runs install.sh.

set -e

DOTFILES="$HOME/.dotfiles"

if [ -d "$DOTFILES" ]; then
    echo "~/.dotfiles already exists, pulling latest..."
    git -C "$DOTFILES" pull
else
    echo "Cloning dotfiles..."
    git clone https://github.com/AlexBlck/dotfiles.git "$DOTFILES"
fi

cd "$DOTFILES"
sh install.sh
