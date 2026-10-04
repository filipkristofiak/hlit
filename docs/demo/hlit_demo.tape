# hlit demo — record with: npm run demo
Output docs/demo/hlit_demo.gif
Set Image docs/demo/hlit_demo_base.png
Set Width 1260
Set Height 880
Set Framerate 10
Set PlaybackSpeed 1.25
Set TypingSpeed 100ms
Set MoveDuration 400ms
Set DragDuration 700ms

# Paste a screenshot
Sleep 1s
Ctrl+V
Sleep 1.2s

# Highlight table cells with group 1
Drag 88,404 388,425
Sleep 300ms
Drag 88,454 388,475
Sleep 300ms
Drag 812,454 1182,475
Sleep 600ms

# Select two highlights, reassign to group 2, then 3
Click 300,464
Sleep 300ms
Meta+Click 1000,464
Sleep 500ms
Type "2"
Sleep 700ms
Type "3"
Sleep 700ms
Escape
Sleep 400ms

# Group 4 from the status bar, bound to the dark side of profile 3
Click "#status .group-btn:nth-child(4)"
Sleep 400ms
Type "p"
Sleep 600ms
Type "j"
Sleep 400ms
Type "3"
Sleep 400ms
Drag 44,112 432,137
Sleep 300ms
Drag 44,188 630,213
Sleep 800ms

# Help overlay for about 1 second in the encoded GIF
Type "?"
Sleep 1.25s
Escape
Sleep 500ms

# Draw: red outline rectangle on the white table
Type "d"
Type "p"
Sleep 700ms
Type "1"
Sleep 400ms
Type "1"
Sleep 300ms
Drag 686,502 808,602
Sleep 600ms

# Draw: white arrow on the dark area
Type "p"
Sleep 500ms
Type "3"
Sleep 400ms
Type "4"
Sleep 300ms
Drag 900,164 636,198
Sleep 600ms

# Annotate: white text
Type "a"
Type "p"
Sleep 500ms
Type "4"
Sleep 300ms
Drag 880,128 1040,156
Sleep 300ms
Type@90ms "annotation"
Sleep 300ms
Enter
Sleep 800ms

# Mask (noise, the default): one dark text row, one table row
Type "m"
Sleep 500ms
Drag 44,74 728,99
Sleep 500ms
Drag 32,627 1184,652
Sleep 1.5s

MoveTo 1150,300
Sleep 2s
