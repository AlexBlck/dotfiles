active_device=$(pacmd list-sinks | awk -F '* index:' '{print $2}')
active_device=$((active_device))

if [ $active_device -eq 0 ]; then
    echo " 󰓃 "
else
    echo "  "
fi
