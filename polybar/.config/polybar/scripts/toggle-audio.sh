active_device=$(pacmd list-sinks | awk -F '* index:' '{print $2}')
active_device=$((active_device))

if [ $active_device -eq 1 ]; then
    pacmd set-default-sink 5
else
    pacmd set-default-sink 1
fi
