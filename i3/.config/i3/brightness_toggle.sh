# get current brightness
brightness=$(ddcutil getvcp 10 | awk -F '=' '{print $2}' | awk -F ',' '{print $1}' | awk '{gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print}')
brightness=$(($brightness))


echo $brightness

if [ $brightness -le 40 ]; then
    brightness=100
else
    brightness=0
fi

ddcutil setvcp 10 $brightness
# echo $brightness >> /home/alex/.config/i3status-rust/brightness
touch /home/alex/.config/i3status-rust/brightness
