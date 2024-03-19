# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

export ZSH=$HOME/.oh-my-zsh

ZSH_THEME="powerlevel10k/powerlevel10k" #"dracula-pro"

COMPLETION_WAITING_DOTS="true"

plugins=(
	git
	zsh-autosuggestions
	zsh-vi-mode
)
source $ZSH/oh-my-zsh.sh

RPROMPT='%*'

#Ignore upper and lowercase when TAB completion
#bind "set completion-ignore-case on"

#Extraction alias
ex ()
{
  if [ -f $1 ] ; then
    case $1 in
      *.tar.bz2)   tar xjf $1   ;;
      *.tar.gz)    tar xzf $1   ;;
      *.bz2)       bunzip2 $1   ;;
      *.rar)       unrar x $1   ;;
      *.gz)        gunzip $1    ;;
      *.tar)       tar xf $1    ;;
      *.tbz2)      tar xjf $1   ;;
      *.tgz)       tar xzf $1   ;;
      *.zip)       unzip $1     ;;
      *.Z)         uncompress $1;;
      *.7z)        7z x $1      ;;
      *.deb)       ar x $1      ;;
      *.tar.xz)    tar xf $1    ;;
      *.tar.zst)   unzstd $1    ;;
      *.rar)       unrar x $1    ;;
      *)           echo "'$1' cannot be extracted via ex()" ;;
    esac
  else
    echo "'$1' is not a valid file"
  fi
}

#ALIASES

#UI alias'
alias c='clear'
alias cls='clear'
alias cs='cd && clear'

#Navigation alias'
alias ..='cd ..'                  #Go back 1 parent directorie
alias ...='cd ../..'              #Go back 2 parent directories
alias .3='cd ../../..'            #Go back 3 parent directories
alias .4='cd ../../../..'         #Go back 4 parent directories
alias .5='cd ../../../../..'      #Go back 5 parent directories

#Listing alias'
alias ls='eza -l'                 #List
alias la='eza -la'                #List all
alias ld='eza -lD'                #List directories
alias l.='eza -a | egrep "^\."'   #List only hidden directories and files

#Move and copy with progress bar
alias mv='mvg -g'
alias cp='cpg -g'

#Bat cat
alias cat='bat'

#Dutree
alias du='dutree -d'

#Pacman and Yay
alias pacsyu='sudo pacman -Syyu'                 # update only standard pkgs
alias yaysua="yay -Sua --noconfirm"              # update only AUR pkgs
alias yaysyu="yay -Syu --noconfirm"              # update standard pkgs and AUR pkgs
alias unlock="sudo rm /var/lib/pacman/db.lck"    # remove pacman lock
alias cleanup='sudo pacman -Rns $(pacman -Qtdq)' # remove orphaned packages
alias pac='sudo pacman -Sy'

#Get top process eating memory
alias psmem='ps auxf | sort -nr -k 4'
alias psmem10='ps auxf | sort -nr -k 4 | head -10'

#Get top process eating cpu ##
alias pscpu='ps auxf | sort -nr -k 3'
alias pscpu10='ps auxf | sort -nr -k 3 | head -10'

#Git
alias addup='git add -u'
alias addall='git add .'
alias branch='git branch'
alias checkout='git checkout'
alias clone='git clone'
alias commit='git commit -m'
alias fetch='git fetch'
alias pull='git pull origin'
alias push='git push origin'
alias status='git status'
alias tag='git tag'
alias newtag='git tag -a'
alias config='/usr/bin/git --git-dir=$HOME/dotfiles/ --work-tree=$HOME'

#Get error messages
alias jctl="journalctl -p 3 -xb"
alias awesome-logs='vim ~/.local/share/sddm/xorg-session.log'

#Distro info
alias distro='cat /etc/*-release'
alias myip='curl ipv4.icanhazip.com'

#File manipulation
alias rm='rm -i'
alias cp='cp -i'
alias mkdir='mkdir -pv'
alias free='free -mt'

# switch between shells
alias tobash="sudo chsh $USER -s /bin/bash && echo 'Now log out.'"
alias tozsh="sudo chsh $USER -s /bin/zsh && echo 'Now log out.'"

# the terminal rickroll
alias rr='curl -s -L https://raw.githubusercontent.com/keroserene/rickrollrc/master/roll.sh | bash'

alias ps='ps auxf'
alias psgrep='ps aux | grep -v grep | grep -i -e VSZ -e'
alias wget='wget -c'
alias histg='history | grep'
alias grep='grep --color=auto'
alias root='root -l'

# NVIM
alias vim='nvim'

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


autoload -Uz compinit
zstyle ':completion:*' menu select
fpath+=~/.zfunc

eval $(thefuck --alias)

# cargo (dutree)
# export PATH="/home/alex/.cargo/bin:$PATH"
# snaps
# export PATH=/var/lib/snapd/snap/bin:$PATH


fpath+=${ZDOTDIR:-~}/.zsh_functions

# random tmux fixes
export TERM=screen-256color
# export LC_ALL=en_IN.UTF-8
# export LANG=en_IN.UTF-8
# alias tmux="TERM=screen-256color-bce tmux"

# nnn
BLK="0B" CHR="0B" DIR="04" EXE="06" REG="00" HARDLINK="06" SYMLINK="06" MISSING="00" ORPHAN="09" FIFO="06" SOCK="0B" OTHER="06"
export NNN_FCOLORS="$BLK$CHR$DIR$EXE$REG$HARDLINK$SYMLINK$MISSING$ORPHAN$FIFO$SOCK$OTHER"
export NNN_PLUF="autojump"

if [ "$TMUX" = "" ]; then tmux; fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
# nvm use 19

eval "$(zoxide init --cmd cd zsh)"

# CTRL-/ to toggle small preview window to see the full command
# CTRL-Y to copy the command into clipboard using pbcopy
export FZF_CTRL_R_OPTS="
  --preview 'echo {}' --preview-window up:3:hidden:wrap
  --bind 'ctrl-/:toggle-preview'
  --bind 'ctrl-y:execute-silent(echo -n {2..} | pbcopy)+abort'
  --color header:italic
  --header 'Press CTRL-Y to copy command into clipboard'"
