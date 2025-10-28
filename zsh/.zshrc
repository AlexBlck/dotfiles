# # Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
#   source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
# fi

# # Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# # To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
# [[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh


# COMPLETION_WAITING_DOTS="true"
autoload -Uz compinit
compinit -u
# autoload -Uz +X bashcompinit && bashcompinit
# setopt MENU_COMPLETE
# setopt COMPLETE_ALIASES

# https://github.com/Jguer/yay/issues/1110
# zstyle ':completion:*' rehash true

zstyle ':completion:*' menu select
zstyle ':completion::complete:*' gain-privileges 1
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'
# CASE_SENSITIVE=true

export NVM_COMPLETION=true
export NVM_DIR=${HOME}/.nvm

# OBS

# export XDG_CURRENT_DESKTOP=sway
# export XDG_SESSION_DESKTOP=sway
# export XDG_SESSION_TYPE=wayland
# export MOZ_ENABLE_WAYLAND=1
# export QT_QPA_PLATFORM=wayland
# export WAYLAND_DISPLAY=wayland-1

#RPROMPT='%*'

# History
HISTFILE="$HOME/.zsh_history"
HISTSIZE=100000
SAVEHIST=100000
setopt INC_APPEND_HISTORY        # Write to the history file immediately, not when the shell exits.
# setopt SHARE_HISTORY             # Share history between all sessions.
setopt HIST_EXPIRE_DUPS_FIRST    # Expire duplicate entries first when trimming history.
setopt HIST_IGNORE_DUPS          # Don't record an entry that was just recorded again.
setopt HIST_IGNORE_ALL_DUPS      # Delete old recorded entry if new entry is a duplicate.
setopt HIST_FIND_NO_DUPS         # Do not display a line previously found.
setopt HIST_IGNORE_SPACE         # Don't record an entry starting with a space.
setopt HIST_SAVE_NO_DUPS         # Don't write duplicate entries in the history file.
setopt HIST_REDUCE_BLANKS        # Remove superfluous blanks before recording entry.

# Search based on what is already filled
# autoload -U history-search-end
# zle -N history-beginning-search-backward-end history-search-end
# zle -N history-beginning-search-forward-end history-search-end
# bindkey "^[[A" history-beginning-search-backward-end
# bindkey "^[[B" history-beginning-search-forward-end
bindkey "^[[A" history-substring-search-up
bindkey "^[[B" history-substring-search-down
# ZSH_AUTOSUGGEST_CLEAR_WIDGETS+=(history-beginning-search-backward-end history-beginning-search-forward-end)
HISTORY_SUBSTRING_SEARCH_FUZZY=1

# Remove underline
(( ${+ZSH_HIGHLIGHT_STYLES} )) || typeset -A ZSH_HIGHLIGHT_STYLES
ZSH_HIGHLIGHT_STYLES[path]=none
ZSH_HIGHLIGHT_STYLES[path_prefix]=none

# Source aliases
source ~/.zsh_aliases

#zstyle ':completion:*' menu select
# zstyle ':completion:*' menu select matcher-list '' 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=*' 'l:|=* r:|=*'

# alacritty zsh completions
# fpath+=~/.zsh_functions
# fpath+=~/usr/share/zsh/site-functions

# random tmux fixes
# export TERM=xterm-256color
# export LC_ALL=en_IN.UTF-8
# export LANG=en_IN.UTF-8
# alias tmux="TERM=xterm-256color tmux"


# export NVM_DIR="$HOME/.nvm"
# [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
# [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
# nvm use 19

# CTRL-/ to toggle small preview window to see the full command
# CTRL-Y to copy the command into clipboard using pbcopy
export FZF_CTRL_R_OPTS="
  --preview 'echo {}' --preview-window up:3:hidden:wrap
  --bind 'ctrl-/:toggle-preview'
  --bind 'ctrl-y:execute-silent(echo -n {2..} | pbcopy)+abort'
  --color header:italic
  --header 'Press CTRL-Y to copy command into clipboard'"

# Fzf colors
export FZF_DEFAULT_OPTS=" \
--color=bg+:#363a4f,bg:#24273a,spinner:#f4dbd6,hl:#ed8796 \
--color=fg:#cad3f5,header:#ed8796,info:#c6a0f6,pointer:#f4dbd6 \
--color=marker:#f4dbd6,fg+:#cad3f5,prompt:#c6a0f6,hl+:#ed8796"

# Use Nix
. $HOME/.nix-profile/etc/profile.d/nix.sh

# Plugins built with antibody
# source ~/.zsh_plugins.sh
source <(antibody init)
antibody bundle < ~/.zsh_plugins.txt

# Alias z to cd (zoxide)
eval "$(zoxide init --cmd cd zsh)"

# oh-my-posh
eval "$(oh-my-posh init zsh --config ~/.config/ohmyposh/config.toml)"

# The next line updates PATH for the Google Cloud SDK.
if [ -f '/mnt/nvme/projects/atmosphere/google-cloud-sdk/path.zsh.inc' ]; then . '/mnt/nvme/projects/atmosphere/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/mnt/nvme/projects/atmosphere/google-cloud-sdk/completion.zsh.inc' ]; then . '/mnt/nvme/projects/atmosphere/google-cloud-sdk/completion.zsh.inc'; fi
export GTK_THEME=cattpuccin-gtk-theme-mocha
