#!/usr/bin/env bash
# Install Nix
sh <(curl -L https://nixos.org/nix/install) --no-daemon

# Source Nix
. ~/.nix-profile/etc/profile.d/nix.sh

# Add nixpkgs channel
nix-channel --add https://nixos.org/channels/nixpkgs-unstable nixpkgs
nix-channel --update

# Install packages
nix-env -iA \
	nixpkgs.zsh \
	nixpkgs.antidote \
	nixpkgs.stow \
	nixpkgs.neovim \
	nixpkgs.lazygit \
	nixpkgs.bat \
	nixpkgs.nodejs_24 \
	nixpkgs.bottom \
	nixpkgs.ripgrep \
	nixpkgs.gdu \
	nixpkgs.fzf \
	nixpkgs.zoxide \
	nixpkgs.eza \
	nixpkgs.oh-my-posh \
	nixpkgs.tmux \

# Stow everything!
stow nvim
stow zsh
stow tmux
stow ohmyposh

# Install TPM and tmux plugins
git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/plugins/tpm --depth=1 2>/dev/null || true
if command -v tmux >/dev/null 2>&1; then
    ~/.config/tmux/plugins/tpm/scripts/install_plugins.sh
fi
