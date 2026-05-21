# handleKeyEvent and keyPress refactor

There is a bug with how the global keybinding tree works, and a feature I would like to add. Both
would be done as a refactor of these methods since it should be made more straightforward anyways.

 1. global mode is consuming keystrokes when matched. I.e. Esc will never get to branch because
global mode sees it as a node to move to. should do both.

 2. There should be some kind of command emitted whenever internal state changes, for the purpose of
allowing the consumer to check their current keybind position in order to display user help.

However, this does require reflection, as it implies that the consumer is using part of keybinder
state. when the idea is consumer should behave identically if commands come from a keybinder or from
a simple replay of commands. The question of how to balance.

