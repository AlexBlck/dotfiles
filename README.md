```sh
curl -LsSf https://raw.githubusercontent.com/AlexBlck/dotfiles/main/bootstrap.sh | sh
```

After install, set zsh as your default shell:
```sh
echo "$HOME/.nix-profile/bin/zsh" | sudo tee -a /etc/shells
chsh -s "$HOME/.nix-profile/bin/zsh"
```

# Non-root installation
https://nixos.wiki/wiki/Nix_Installation_Guide#Installing_without_root_permissions
