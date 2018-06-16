const constants = { // Object to store static values
  playerWidth: 40,
  escapeKey: 27,
  spaceKey: 32
}
const stateData = { // Object to store game state
  $glass: null,
  $pause: null,
  $player: null,
  $enemySpace: null,
  $bonusSpace: null,
  $bulletSpace: null,
  $instructions: null
}
const sizeData = {} // Object to store information that might change on resize
const $pCollidables = []; // Array to store things the player can shoot
const $pProjectiles = []; // Array to store players fired projectiles
const $eProjectiles = []; // Array to store enemy projectiles
const powerups = [ // Array to store all the possible power ups
  {name: 'test', quantity: '5', modifierType: 'weapon', modifierClass: 'ani-pbullet-expand'}
]

// Reset the state data back to the defaults (anything that could have changed)
const resetState = () => {
  // boolean states
  stateData.canFire = true;
  stateData.gamePaused = true;
  // counter states
  stateData.nextEnemyId = 0;
  stateData.nextPowerUpId = 0;
  stateData.nextBulletId = 0;
  stateData.powerShotsRemaining = 0;
  // string states
  stateData.powerShotClass = null;
  // misc
  stateData.collisionDetectionTimer = null;
}

// Keep track of things that might change if the screen size changes
const populateSizeData = () => {
  sizeData.glassBounds = rect(stateData.$glass);
}

// See if 2 sprites share the same screen space
const boundsOverlap = (sprite1, sprite2) => {
  // We use clientRect() instead of rect() because we don't care about midpoints
  // but we need this to be as fast as possible
  let s1 = sprite1.clientRect();
  let s2 = sprite2.clientRect();
  return !(s1.top>s2.bottom||s1.bottom<s2.top||s1.left>s2.right||s1.right<s2.left);
}

// Function to see if anything collided
const checkForCollisions = () => {
  // Check if the enemy bullets hit the player
  for (let $eBullet of $eProjectiles) {
    if (boundsOverlap($eBullet, stateData.$player)) {
      // Player was hit by an enemy bullet
      playerDied();
      return;
    }
  }
  // Check of any of the player bullets hit anything
  let bToRemove = [];
  for (let bi=0; bi<$pProjectiles.length; bi++) {
    let cToRemove = null;
    for (let ci=0; ci<$pCollidables.length; ci++) {
      let target = $pCollidables[ci];
      if (boundsOverlap($pProjectiles[bi], target)) {
        // A player bullet hit something
        // We can't use the cleanCollidable function because we are iterating over the array
        $pProjectiles[bi].remove(); // get rid of the bullet
        cToRemove = ci;
        bToRemove.push(bi);
        bulletImpact(target); // do additional actions based on what was hit
        // this bullet is used so break out of inner loop
        break;
      }
    }
    // If somethingwas hit, remove it from the collision tracking array
    if (cToRemove != null) $pCollidables.splice(cToRemove, 1);
  }
  // Clean up the bullet collision tracking array (is there a faster way to do this?)
  for (let idx of bToRemove) $pProjectiles.splice(idx, 1);
}

// Make sure a colidable is cleaned off the DOM and the collision array
const cleanCollidable = ($obj, $array) => {
  let objId = $obj.attr('data-id');
  let idx = $array.findIndex(($o)=>{ return $o.attr('data-id') == objId; });
  if (idx > -1) $array.splice(idx, 1);
  $obj.remove();
}

// Handle a player bullet hitting something
const bulletImpact = ($target) => {
  // Remove the object from the DOM
  $target.remove();
  // Decide what to do based on what was hit
  if ($target.attr('data-id').startsWith('e')) {
    // An enemy was hit
    console.log('Player hit an enemy');
  } else {
    // The only other thing to hit is a powerup
    if ($target.attr('data-pu-type') == 'weapon') {
      stateData.powerShotClass = $target.attr('data-pu-class');
      stateData.powerShotsRemaining = $target.attr('data-pu-quantity');
    }
  }
}

// Handle a player getting hit by a bullet
const playerDied = (target) => {
  console.log('Player died');
}

// Helper method to calculat the mid points when getting a rect
const rect = (jQueryObj) => {
  // Get the base clientRect
  let bounds = jQueryObj.clientRect();
  // Add additional fields that are used a lot
  bounds.halfWidth = bounds.width/2;
  bounds.halfHeight = bounds.height/2;
  bounds.xMid = bounds.left+bounds.halfWidth;
  bounds.yMid = bounds.top+bounds.halfHeight;
  // Return the updated rect
  return bounds;
}

// Figure out where the projectile should spawn
const getPowerUpSpawnInfo = () => {
  // Initialize some variables for function scope
  let xPos = null;
  let animation = null;
  // Vertical start is always the same
  let yPos = 40;
  // Generate a random boolean
  let bool = (Math.trunc(Math.random()*2)%2 == 0);
  // Randomly start from right or left
  if (bool) {
    // Start from the left
    xPos = -50;
    animation = 'ani-glide-right';
  } else {
    // Start from the right
    xPos = 650;
    animation = 'ani-glide-left';
  }
  // Return the spawn point and animation name
  return { x: xPos, y: yPos, ani: animation };
}

// Spawn a particular powerup
const spawnPowerUp = (index=0) => {
  let powerUpInfo = powerups[index];
  let spawnInfo = getPowerUpSpawnInfo();
  let powerUp = $('<div>').addClass('power-up-'+powerUpInfo.name)
    // Add an id so that it is easier to identify
    .attr('data-id', 'pu-'+stateData.nextPowerUpId++)
    // Add powerup info to div for later user
    .attr('data-pu-type', powerUpInfo.modifierType)
    .attr('data-pu-class', powerUpInfo.modifierClass)
    .attr('data-pu-quantity', powerUpInfo.quantity)
    // Center it at the spawn point
    .css('top', spawnInfo.y+'px')
    .css('left', spawnInfo.x+'px')
    // Have it remove itself from the DOM when the animation ends
    .bind('oanimationend animationend webkitAnimationEnd', (event) => {
       cleanCollidable($(event.currentTarget), $pCollidables);
    });
    // Attach it to the DOM
    $('#bonus-space').append(powerUp);
    // Start the animation
    powerUp.addClass(spawnInfo.ani);
    // Make sure the powerup is tracked for collision
    $pCollidables.push(powerUp);
}

// Figure out where the projectile should spawn
const getProjectileSpawnPoint = (originator, isPlayer) => {
  let oBounds = rect(originator);
  // X position is in the middle of the sprite
  let xPos = oBounds.xMid;
  // Adjust for the glass position
  xPos-= sizeData.glassBounds.left;
  // Y position is top for player, bottom for enemies
  let yPos = (isPlayer ? oBounds.top : oBounds.bottom);
  // Adjust for the glass position
  yPos-= sizeData.glassBounds.top;
  // Return a simple point-like object
  return { x: xPos, y: yPos };
}

// The user weapon was fired
const firePlayerWeapon = (spawnPoint) => {
  // Spawn a new player projectile
  let projectile = $('<div>').addClass('player-bullet')
    // Add an id so that it is easier to identify
    .attr('data-id', 'b-'+stateData.nextBulletId++)
    // Center it at the spawn point
    .css('top', Math.round(spawnPoint.y-5)+'px')
    .css('left', Math.round(spawnPoint.x-5)+'px')
    // Have it remove itself from the DOM when the animation ends
    .bind('oanimationend animationend webkitAnimationEnd', (event) => {
       cleanCollidable($(event.currentTarget), $pProjectiles);
    });
    // Attach it to the DOM
    $('#projectile-space').append(projectile);
    // Start the animation
    let bulletAni = "ani-pbullet-normal";
    if (stateData.powerShotsRemaining > 0) {
      bulletAni = stateData.powerShotClass;
      stateData.powerShotsRemaining--;
    }
    projectile.addClass(bulletAni);
    // Make sure the projectile is tracked for collision
    $pProjectiles.push(projectile);
}

// The user attempted to fire their weapon.
const fireWeapon = () => {
  // Only allow firing so often
  if (stateData.canFire) {
    // Temporarily disable firing
    stateData.canFire = false;
    // Fire the weapon
    firePlayerWeapon(getProjectileSpawnPoint(stateData.$player, true));
    // Set a timeout to re-enable firing after .5 seconds
    setTimeout(()=>{ stateData.canFire=true; }, 500);
  }
  // Prevent the event from travelling any further down
  return false;
}

// Make the player ship move with the mouse's horizontal position
const movePlayer = (event) => {
  // Get the position of the mouse relative to the glass div
  let xPos = event.clientX - sizeData.glassBounds.left;
  // Make sure the ship doesn't leave the left side of the screen
  xPos = Math.max(10, xPos);
  // Make sure the ship doesn't leave the right side of the screen
  let rightEdge = sizeData.glassBounds.width-constants.playerWidth;
  xPos = Math.min(xPos, rightEdge-10);
  // Reposition the player's ship
  stateData.$player.css('left', Math.round(xPos)+'px');
}

// This only needs to happen once
const stateInit = () => {
  // Initialize the state data that will never change after initial load
  stateData.$glass = $('#glass');
  stateData.$pause = $('#pause');
  stateData.$player = $('#player');
  stateData.$enemySpace = $('#enemy-space');
  stateData.$bonusSpace = $('#bonus-space');
  stateData.$bulletSpace = $('#projectile-space');
  stateData.$instructions = $('#instructions');
}

// Start the game
const startNewGame = () => {
  // Reset the state data
  resetState();
  // Unpause the game
  toggleGamePaused();
}

// Set the animation state for all of the sprites
const setAnimationState = (paused) => {
  // All the places where sprites might live
  let spriteLocations = [stateData.$enemySpace, stateData.$bonusSpace, stateData.$bulletSpace];
  // Check all locations
  for (let i=0; i<spriteLocations.length; i++) {
    // Get the list of sprites in this location
    let $children = spriteLocations[i].children();
    for (let idx=0; idx<$children.length; idx++) {
      // Pause or unpause animation based on parameter
      if (paused) {
        $children.eq(idx).addClass('paused');
      } else {
        $children.eq(idx).removeClass('paused');
      }
    }
  }
}

// Pause or unpause the game
const toggleGamePaused = () => {
  if (stateData.gamePaused) {
    // Game is paused, resume it
    stateData.$pause.addClass('hidden');
    // Have the glass layer listen for mouse moves and clicks
    stateData.$glass.on('mousemove', movePlayer);
    // Start the collision detection timer
    stateData.collisionDetectionTimer = setInterval(checkForCollisions, 100);
    // Resume all of the sprite animations
    setAnimationState(false);
    // Update the paused state
    stateData.gamePaused = false;
  } else {
    // Game is running, pause it
    stateData.$pause.removeClass('hidden');
    // Stop the collision detection timer
    clearInterval(stateData.collisionDetectionTimer);
    // Stop the glass layer from listening for mouse moves
    stateData.$glass.off('mousemove', movePlayer);
    // Pause all of the sprite animations
    setAnimationState(true);
    // Update the paused state
    stateData.gamePaused = true;
  }
}

// Listen for escape key events to trigger pause function
const keyListener = (event) => {
  if (event.keyCode === constants.spaceKey) {
    if (!stateData.gamePaused) {
      // Pressed space while the game was running
      fireWeapon();
    }
  } else if (event.keyCode === constants.escapeKey) {
    // Close the instructions if they are open
    stateData.$instructions.css('display', 'none');
    // toggle the paused state
    toggleGamePaused();
  }
  return false;
}

// To run after page loads
const runOnReady = () => {
  // Perform the one-time state init
  stateInit();
  // Make sure we know how big things are
  populateSizeData();
  // Add the global button listeners

  // Handle window resizes
  $(window).on('resize', populateSizeData);
  // Handle key presses
  $(document).on('keyup', keyListener);

  // For testing purposes
  startNewGame();
  setTimeout(spawnPowerUp, 5000);
}

// Run when the page is done loading
$(runOnReady);
