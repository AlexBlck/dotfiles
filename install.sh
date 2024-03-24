# Install Nix
sh <(curl -L https://nixos.org/nix/install) --no-daemon

# Source Nix
. ~/.nix-profile/etc/profile.d/nix.sh

# Install packages
nix-env -iA \
	nixpkgs.zsh \
	nixpkgs.antibody \
	nixpkgs.stow \
	nixpkgs.neovim \
	nixpkgs.lazygit \
	nixpkgs.bat \
	nixpkgs.nodejs_18 \
	nixpkgs.bottom \
	nixpkgs.ripgrep \
	nixpkgs.gdu \
	nixpkgs.fzf \
	nixpkgs.zoxide \
	nixpkgs.eza \

# Bundle zsh plugins with antibody
antibody bundle < zsh/.zsh_plugins.txt > zsh/.zsh_plugins.sh

# Stow everything!
stow nvim
stow zsh
# stow tmux
