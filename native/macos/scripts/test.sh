#!/bin/zsh
set -euo pipefail
cd "${0:A:h:h}"

# CLT includes Swift Testing but does not expose its framework search path to SwiftPM.
task_developer_path="$(xcode-select -p)"
task_testing_frameworks="$task_developer_path/Library/Developer/Frameworks"
if [[ "$task_developer_path" == */CommandLineTools && -d "$task_testing_frameworks/Testing.framework" ]]; then
  swift test \
    -Xswiftc -F -Xswiftc "$task_testing_frameworks" \
    -Xlinker -F -Xlinker "$task_testing_frameworks" \
    -Xlinker -rpath -Xlinker "$task_testing_frameworks" "$@"
else
  swift test "$@"
fi
