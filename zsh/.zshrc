# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# COMPLETION_WAITING_DOTS="true"

autoload -Uz compinit
compinit

export NVM_COMPLETION=true
export NVM_DIR=${HOME}/.nvm

#RPROMPT='%*'

#Ignore upper and lowercase when TAB completion
#bind "set completion-ignore-case on"

# Source aliases
source ~/.zsh_aliases

# Python test boilerplate
alias leet='mkdir -p tests task && touch tests/__init__.py tests/test_task.py task/__init__.py task/task.py setup.cfg' #&& echo "import pytest" > tests/test_task.py && echo "def test_task():\n    assert True" >> tests/test_task.py && echo "def task():\n    pass" >> task/task.py && vim tests/test_task.py task/task.py && '

#misc functions
#kernel () {
#  OUTPUT=$(uname -srm)
#  echo "Current Kernel: ${OUTPUT}"
#}

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/usr/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/usr/etc/profile.d/conda.sh" ]; then
        . "/usr/etc/profile.d/conda.sh"
    else
        export PATH="/usr/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<


#zstyle ':completion:*' menu select
# fpath+=~/.zfunc

# random tmux fixes
export TERM=screen-256color
# export LC_ALL=en_IN.UTF-8
# export LANG=en_IN.UTF-8
# alias tmux="TERM=screen-256color-bce tmux"

if [ "$TMUX" = "" ]; then tmux; fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
# nvm use 19


# CTRL-/ to toggle small preview window to see the full command
# CTRL-Y to copy the command into clipboard using pbcopy
export FZF_CTRL_R_OPTS="
  --preview 'echo {}' --preview-window up:3:hidden:wrap
  --bind 'ctrl-/:toggle-preview'
  --bind 'ctrl-y:execute-silent(echo -n {2..} | pbcopy)+abort'
  --color header:italic
  --header 'Press CTRL-Y to copy command into clipboard'"

source ~/.zsh_plugins.sh

# Use Nix
. $HOME/.nix-profile/etc/profile.d/nix.sh 

eval "$(zoxide init --cmd cd zsh)"
