# Fight to Win!
Fight to Win! is a client-side, browser based, 2D space shooter where the only way to win is to defeat all the enemies.

In the game, you are the pilot of a lone fighter battling a horde of invading enemies. You have only your agility and an infinite supply of ammo to aid you in surviving the alien onslaught.

The controls are fairly simple. Move your mouse left and right over the battlefield to avoid enemy fire or align the perfect shot. Use the space key to fire your weapons and the escape key will pause the game.

Throught the battle, you should keep an eye out for passing bonus containers which hold useful perks like additional points, upgraded ammo, temporary invulnerability, and extra lives.

If you are up for the challenge, you can play the game [here](https://psycoder42.github.io/fight-to-win/game/index.html) (modern Chrome browser is highly recommended).

### Playing Locally
This game is intended to be played online but it is possible to play it locally. However, the mechanism which provides the sound may be unable to load the sound files successfully when the page is loaded directly from the file system so you may get choppy, incorrect, or completely absent sound. The workaround is to locally host the game in a simple web server.

To get the best local play experience you can follow these steps:
1. Download or clone this repo onto your system
2. Start the game in a local web server
    1. In a terminal, navigate into the repo directory containing index.html
    2. Start up a Python web server on a specific port (this example will use port 8888)
        * For Python 2.X: `python -m SimpleHTTPServer 8888`
        * For Python 3.X: `python -m http.server 8888`
3. Open your broswer and type in the url http://localhost:8888/game/index.html (modern Chrome browser is highly recommended)

### Under the Covers
This game was created using many of the modern features of HTML, CSS, JavaScript, and jQuery. In addition, I used a couple 3rd party extensions to provide some additional functionality.

The first 3rd party extension used was skinny.js (<http://vistaprint.github.io/SkinnyJS/>) which provided a jQuery extension allowing for faster and more efficient retrieval of an element's absolute position on the DOM.

The second 3rd party component used was howler.js (<https://howlerjs.com/>) which provided audio management and greatly simplified the process of incorporating sound into the game.

### The Method Behind the Madness
The approach I took with this game was to attempt to do as much in HTML and CSS as possible. While JavaScript clearly plays a major role, I didn't want it to do everything. All of the movement in this game, aside from the player movement which follows the player's mouse, is done with CSS animations.  All images in this game are static png files so any movements/changes/modifications are done through CSS. Where reasonable, HTML attributes were used as variable/data storage instead of JavaScript variables.

Because of my approach, some potential inefficiencies were introduced. For example, I stayed away from creating JavaScript classes that were more self-contained and autonomous in order to avoid a situation where the classes would be doing all of the heavy lifting. Also, rather than having a global timer to use for timing events and movement, I relied on CSS animations and callbacks to trigger events. The only global timer I have controls collision detection.

Another side effect of the focus on CSS is a heavy reliance on randomness. Rather than use JavaScript to control enemies and movements and other things that would need coordination, many core level elements are randomly decided (enemy types, enemy weapons, enemy movement, enemy fire rate, bonus spawns, bonus types, etc). 

### Known Issues
* In browsers other than Chrome, firing may not work until the user clicks on the game screen
* In browsers other than Chrome, opening the settings or instructions after pausing the game may bring up the dialog with everything highlighted
* The invulnerable bonus doesn't pause correctly at wave end or when the user manually pauses the game
* Based on the frequency of the collision detections checks, fast moving enemies, bullets, or bonuses may avoid collision detection on occasion
* If the player's mouse leaves the game area, the player's ship will stop responding to mouse movement (this is intentional albeit annoying)
* As mentioned in the Playing Locally section, sounds are flakey when the game is played directly from the file system

### Potential Future Additions
* Additional bonuses and weapons
* Additional enemy types
* Scripted enemy movements
* Boss fights
* Choice of background music
