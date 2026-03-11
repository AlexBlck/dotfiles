#!/usr/bin/env bash
# Install Nix
curl -L https://nixos.org/nix/install -o /tmp/nix-install.sh
sh /tmp/nix-install.sh --no-daemon

# Source Nix
. ~/.nix-profile/etc/profile.d/nix.sh

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

# Bundle zsh plugins with antibody
antidote bundle < zsh/.zsh_plugins.txt > zsh/.zsh_plugins.sh

# Stow everything!
stow nvim
stow zsh
stow tmux
stow ohmyposh

# Install TPM and tmux plugins
git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/plugins/tpm --depth=1 2>/dev/null || true
~/.config/tmux/plugins/tpm/scripts/install_plugins.sh
