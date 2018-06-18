const constants = { // Object to store static values
  playerWidth: 40,
  playerHeight: 40,
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
  $playerSpace: null,
  $instructions: null
}
const enemyOps = { // The random grab bag that makes up the enemys and their behavior
  type: ['basic'],
  bullets: ['ani-ebullet-normal'],
  style: ['ani-enemy-smooth','ani-enemy-smooth-fast'],
  endpoints: ['a','b','c','d','e','f','g','h']
}
const powerUps = [ // Array to store all the possible power ups
  {name: 'expand-shot', quantity: 5, modifierType: 'weapon', modifierClass: 'ani-pbullet-expand'},
  {name: 'shield', modifierType: 'ship'},
  {name: 'invulnerable', modifierType: 'ship'}
]
const sizeData = {} // Object to store information that might change on resize
const timeoutMap = {} // Object to keep track of all the active timeouts
const $pCollidables = []; // Array to store things the player can shoot
const $pProjectiles = []; // Array to store players fired projectiles
const $eProjectiles = []; // Array to store enemy projectiles
const $miscSprites = []; // Array to store other pausable sprites
const $cutsceneActors = []; // Array to store actors in a cutscene

// Keep track of things that might change if the screen size changes
const populateSizeData = () => {
  sizeData.glassBounds = rect(stateData.$glass);
}

// Remove all the elements in an array
const clearArray = (array) => {
  if (array!=null && array instanceof Array) {
    while (array.length > 0) array.pop();
  }
}

// Remove all the keys in an object
const clearObject = (obj) => {
  if (obj != null) {
    let keys = Object.keys(obj);
    for (let key of keys) delete obj[key];
  }
}

// Reset the arrays and objects appropriately
const resetObjectStates = () => {
  // Stop all of the timeouts
  let keys = Object.keys(timeoutMap);
  for (let key of keys) clearTimeout(obj[key]);
  clearObject(timeoutMap);
  // Remove all sprites from the game
  for (let $array of [$pCollidables,$pProjectiles,$eProjectiles,$miscSprites]) {
    for (let $sprite of $array) $sprite.remove();
    clearArray($array);
  }
  // Clean out without doing anything with the elements
  clearArray($cutsceneActors);
}

// Reset the UI elements
const resetUI = () => {
  // Hide all of the popup screens
  hideAllPopups();
}

// Reset the state data back to the defaults (anything that could have changed)
const resetState = () => {
  // boolean states
  stateData.inGame = false;
  stateData.canFire = true;
  stateData.cutscene = false;
  stateData.gamePaused = false;
  stateData.playerHasShield = false;
  stateData.playerInvulnerable = false;
  // counter states
  stateData.nextEnemyId = 0;
  stateData.nextPowerUpId = 0;
  stateData.nextBulletId = 0;
  stateData.nextAnimationId = 0;
  stateData.powerShotsRemaining = 0;
  stateData.livesRemaining = 3;
  stateData.enemiesSpawned = 0;
  // string states
  stateData.powerShotClass = null;
  // misc
  stateData.collisionDetectionTimer = null;
  // Clean up objects and UI
  resetObjectStates();
  resetUI();
}

// Helper function to generate a random boolean
const flipCoin = () => {
  return (Math.trunc(Math.random()*2)%2 == 0);
}

// Move a sprite to its current location with respects to a parent
const affixPositionToParent = ($sprite, $parent) => {
  let sBounds = $sprite.clientRect();
  let pBounds = $parent.clientRect();
  // Affix the sprite to the parent (adjust for the parent offset)
  $sprite.css('top', (sBounds.top-pBounds.top)+'px').css('left', (sBounds.left-pBounds.left)+'px');
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
  // Check if the enemy bullets hit the player unless the player is invulnerable
  if (!stateData.playerInvulnerable) {
    let playerWasHit = false;
    let bToRemove = [];
    for (let $eBullet of $eProjectiles) {
      if (boundsOverlap($eBullet, stateData.$player)) {
        $eBullet.detach();
        bToRemove.push($eBullet);
        if (stateData.playerHasShield) {
          // Shield protected the player
          stateData.$player.removeClass('shield');
          stateData.playerHasShield = false;
          continue;
        } else {
          // Player was hit by an enemy bullet
          playerDied();
          break;
        }
      }
    }
    // Clean any bullets that made contact
    for (let $bullet of bToRemove) cleanObjectFormArrayAndDOM($bullet, $eProjectiles);
  }
  // Check of any of the player bullets hit anything
  let bToRemove = [];
  for (let bi=0; bi<$pProjectiles.length; bi++) {
    let cToRemove = null;
    for (let ci=0; ci<$pCollidables.length; ci++) {
      let target = $pCollidables[ci];
      if (boundsOverlap($pProjectiles[bi], target)) {
        // A player bullet hit something
        // We can't use the cleanObjectFormArrayAndDOM function because we are iterating over the array
        $pProjectiles[bi].detach(); // get rid of the bullet
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

// Make sure an object is cleaned  out of the collision array
const cleanObjectFormArray = ($obj, $array=null) => {
  if ($array != null) {
    let objId = $obj.attr('data-id');
    let idx = $array.findIndex(($o)=>{ return $o.attr('data-id') == objId; });
    if (idx > -1) $array.splice(idx, 1);
  }
}

// Make sure an object is cleaned off the DOM and the collision array
const cleanObjectFormArrayAndDOM = ($obj, $array=null) => {
  $obj.remove();
  cleanObjectFormArray($obj, $array);
}

// Apply a power up
const applyPowerUp = (index) => {
  let info = powerUps[parseInt(index)];
  if (info.modifierType == 'weapon') {
    stateData.powerShotClass = info.modifierClass;
    stateData.powerShotsRemaining = info.quantity;
  } else if (info.modifierType == 'ship') {
    switch (info.name) {
      case 'invulnerable':
        makePlayerInvulnerable();
        break;
      case 'shield':
        stateData.playerHasShield = true;
        stateData.$player.addClass('shield');
        break;
    }
  }
}

// Handle a player bullet hitting something
const bulletImpact = ($target) => {
  // Decide what to do based on what was hit
  if ($target.attr('data-id').startsWith('e')) {
    // An enemy was hit
    enemyWasDestroyed($target);
  } else {
    // The only other thing to hit is a powerup
    $target.detach();
    applyPowerUp($target.attr('data-pu-idx'));
    $target.remove();
  }
}

// An enemy ship was distroyed
const enemyWasDestroyed = ($enemy) => {
  let enemyId = $enemy.attr('data-id');
  // Stop the enemy from moving
  $enemy.addClass('paused');
  $enemy.off('oanimationend animationend webkitAnimationEnd', moveEnemyCallback);
  // Stop the enemy from firing
  clearTimeout(timeoutMap[enemyId]);
  delete timeoutMap[enemyId];
  // Stop the enemy from being hit again
  cleanObjectFormArray($enemy, $pCollidables);
  // Blow up the enemy
  makeExplode($enemy, benefitFromDeadEnemy);
}

// Final interaction with defeated enemy
const benefitFromDeadEnemy = ($enemy) => {
  // Stop the enemy from appearing on the DOM
  $enemy.detach();
  // Increase the player score and spawn bonuses and stuff

  // Final cleanup of the enemy
  $enemy.remove();
}

// Display an explosion on a sprite
// After the explosion animation is complete, if a callback was provided it
// will be invoked and the sprite that exploded will be passed as an argument
const makeExplode = ($sprite, callback=null, animationNumber=1) => {
  // Spawn the explosion on the center of the sprite
  let spriteRect = rect($sprite);
  let $explosion = $('<div>').addClass('explosion')
      .css('top', (spriteRect.halfHeight-25)+'px')
      .css('left', (spriteRect.halfWidth-25)+'px')
      // Add an id so that it is easier to identify
      .attr('data-id', 'a-'+stateData.nextAnimationId++)
      // Have it remove itself from the DOM when the animation ends
      .on('oanimationend animationend webkitAnimationEnd', null, {callback: callback}, explosionCallback);
  // Make sure to track this animation to allow for pausing
  let trackingArray = $miscSprites;
  if (stateData.cutscene) {
    // This is part of a cutscene, track it there instead
    trackingArray = $cutsceneActors;
  }
  trackingArray.push($explosion);
  // Add the explosion to the sprite
  $sprite.append($explosion);
  // Start the animation
  $explosion.addClass('ani-explosion-'+animationNumber);
}

// Handle a player getting hit by a bullet
const playerDied = (target) => {
  // This is a cutscene so freese the gameplay
  beginCutscene();
  $cutsceneActors.push(stateData.$player);
  // Take away one of their extra lives
  stateData.livesRemaining--;
  // Default callback is to spawn the next life
  let callback = spawnNextLife;
  if (stateData.livesRemaining < 0) {
    // The player is out of lives
    callback = gameOver;
  }
  // Have the player explode
  makeExplode(stateData.$player, callback);
  // Detach the player div
  stateData.$player.detach();
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

// Spawn a random enemy
const spawnEnemy = () => {
  if (!stateData.gamePaused) {
    // Only spawn if the game is not paused
    let eClass = 'enemy-' + enemyOps.type[Math.floor(Math.random()*enemyOps.type.length)];
    let eStyle = enemyOps.style[Math.floor(Math.random()*enemyOps.style.length)];
    let eDest = enemyOps.endpoints[Math.floor(Math.random()*enemyOps.endpoints.length)];
    let eAmmo = enemyOps.bullets[Math.floor(Math.random()*enemyOps.bullets.length)];
    let xPos = (Math.floor(Math.random()*50)+20);
    let enemyId = 'e-'+stateData.nextPowerUpId++
    // Generate the new enemy
    let $enemy = $('<div>').addClass(eClass).addClass('reusable-sprite')
        // Add an id so that it is easier to identify
        .attr('data-id', enemyId)
        // Add the types of bullets this enemy uses
        .attr('data-bullet-type', eAmmo)
        // Set its spawn point
        .css('top', '-50px')
        .css('left', xPos+'%')
        // Attach it to the DOM
    stateData.$enemySpace.append($enemy);
    // Make sure this honors the pause state
    if (stateData.gamePaused) $enemy.addClass('paused');
    // Make sure the enemy is tracked for collision
    $pCollidables.push($enemy);
    // Queue up the enemy firing to start between 1-2 seconds after spawning
    timeoutMap[enemyId] = setTimeout(fireEnemyWeapon, (Math.floor(Math.random()*1000)+1000), $enemy);
    // Start the enemy moving
    moveEnemy($enemy);
    // Record that an enemy was spawned
    stateData.enemiesSpawned++;
  }
}

// Figure out where the projectile should spawn
const getPowerUpSpawnInfo = () => {
  // Initialize some variables for function scope
  let xPos = null;
  let animation = null;
  // Vertical start is always the same
  let yPos = 40;
  // Randomly start from right or left
  if (flipCoin()) {
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
const spawnPowerUp = (index=null) => {
  // Either use the index passed in or a random index
  let pIdx = (index!=null ? index : Math.floor(Math.random()*powerUps.length));
  let powerUpInfo = powerUps[pIdx];
  let spawnInfo = getPowerUpSpawnInfo();
  let $powerUp = $('<div>').addClass('power-up-'+powerUpInfo.name)
      // Add an id so that it is easier to identify
      .attr('data-id', 'pu-'+stateData.nextPowerUpId++)
      // Add powerup info to div for later user
      .attr('data-pu-idx', pIdx)
      // Center it at the spawn point
      .css('top', spawnInfo.y+'px')
      .css('left', spawnInfo.x+'px')
      // Have it remove itself from the DOM when the animation ends
      .on('oanimationend animationend webkitAnimationEnd', null, {array: $pCollidables}, cleanupIndependentSprite);
  // There is a 20% chance to spawn a speed-adjusted bonus
  if (Math.random() <= 0.2) {
    // 50/50 chance to speed up versus slow down
    if (flipCoin()) {
      $powerUp.addClass('fast-bonus');
    } else {
      $powerUp.addClass('slow-bonus');
    }
  }
  // Attach it to the DOM
  $('#bonus-space').append($powerUp);
  // Make sure this honors the pause state
  if (stateData.gamePaused) $powerUp.addClass('paused');
  // Start the animation
  $powerUp.addClass(spawnInfo.ani);
  // Make sure the powerup is tracked for collision
  $pCollidables.push($powerUp);
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

// The player weapon was fired
const firePlayerWeapon = (spawnPoint) => {
  // Spawn a new player projectile
  let $projectile = $('<div>').addClass('player-bullet')
      // Add an id so that it is easier to identify
      .attr('data-id', 'b-'+stateData.nextBulletId++)
      // Center it at the spawn point
      .css('top', Math.round(spawnPoint.y-5)+'px')
      .css('left', Math.round(spawnPoint.x-5)+'px')
      // Have it remove itself from the DOM when the animation ends
      .on('oanimationend animationend webkitAnimationEnd', null, {array: $pProjectiles}, cleanupIndependentSprite);
  // Attach it to the DOM
  $('#projectile-space').append($projectile);
  // Make sure this honors the pause state
  if (stateData.gamePaused) $projectile.addClass('paused');
  // Start the animation
  let bulletAni = "ani-pbullet-normal";
  if (stateData.powerShotsRemaining > 0) {
    bulletAni = stateData.powerShotClass;
    stateData.powerShotsRemaining--;
  }
  $projectile.addClass(bulletAni);
  // Make sure the projectile is tracked for collision
  $pProjectiles.push($projectile);
}

// The enemy weapon was fired
const fireEnemyWeapon = ($enemy) => {
  let enemyId = $enemy.attr('data-id');
  if (!stateData.gamePaused) {
    // Only fire if the game is not paused
    let ammoClass = $enemy.attr('data-bullet-type');
    let spawnPoint = getProjectileSpawnPoint($enemy, false);
    // Spawn a new enemy projectile
    let $projectile = $('<div>').addClass('enemy-bullet')
        // Add an id so that it is easier to identify
        .attr('data-id', 'b-'+stateData.nextBulletId++)
        // Center it at the spawn point
        .css('top', Math.round(spawnPoint.y-5)+'px')
        .css('left', Math.round(spawnPoint.x-5)+'px')
        // Have it remove itself from the DOM when the animation ends
        .on('oanimationend animationend webkitAnimationEnd', null, {array: $eProjectiles}, cleanupIndependentSprite);
    // Attach it to the DOM
    $('#projectile-space').append($projectile);
    // Make sure this honors the pause state

    // Start the animation
    $projectile.addClass(ammoClass);
    // Make sure the projectile is tracked for collision
    $eProjectiles.push($projectile);
  }
  // Queue up the enemy firing to shoot again between .5-2.5 seconds later
  timeoutMap[enemyId] = setTimeout(fireEnemyWeapon, (Math.floor(Math.random()*2000)+500), $enemy);
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

// Move an enemy to its next location
const moveEnemy = ($enemy) => {
  // Get the current location of the enemy
  let currentLoc = $enemy.css('animation-name');
  // Pick its next location
  let nextLoc = currentLoc;
  while (nextLoc == currentLoc) {
    nextLoc = enemyOps.endpoints[Math.floor(Math.random()*enemyOps.endpoints.length)];
  }
  // Add the movement style
  $enemy.addClass(enemyOps.style[Math.floor(Math.random()*enemyOps.style.length)])
      // When the animation complete clean state and repeat
      .on('oanimationend animationend webkitAnimationEnd', moveEnemyCallback);
  // Start the animation
  $enemy.css('animation-name', nextLoc);
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

// Player ship enters the screen
const playerEnter = (callback=null) => {
  // Move the player ship to the starting point
  let glassBounds = rect(stateData.$glass);
  let midGlass = glassBounds.xMid - sizeData.glassBounds.left;
  stateData.$player.css('top','80px')
      .css('left', Math.round(midGlass-(constants.playerWidth/2))+'px')
      // When the animation complete, end the cutscene
      .on('oanimationend animationend webkitAnimationEnd', null, {callback: callback}, playerEnterCallback);
  // Add the player into the player-space div (it was detached)
  stateData.$playerSpace.append(stateData.$player);
  // Start the animation
  stateData.$player.addClass('ani-player-enter');
}

// Make the player invulnerable
const makePlayerInvulnerable = () => {
  // Only if the player is not already invulnerable
  if (!stateData.playerInvulnerable) {
    stateData.$player.on('oanimationend animationend webkitAnimationEnd', makePlayerInvulnerableCallback);
    // Update the state
    stateData.playerInvulnerable = true;
    // Start the invulnerable animation
    stateData.$player.addClass('ani-invulnerable');
  }
}

// Bring in the next ship after a player death
const spawnNextLife = () => {
  // Bring the next ship in and make them temporarily invulnerable
  playerEnter(makePlayerInvulnerable);
}

// The game is over
const gameOver = () => {
  // Make sure everything is stopped
  toggleGamePaused(true);
  // Indicate we have started a game
  stateData.inGame = false;
  // Re-enable the main buttons
  setMainButtonsDisabled(false);
}

// Alter the enablement state of the main window buttons
const setMainButtonsDisabled = (isDisabled) => {
  $('#sidebar-controls > .button').each((idx, button)=>{
    $(button).prop('disabled',isDisabled);
  });
}

// This only needs to happen once
const stateInit = () => {
  // Initialize the state data that will never change after initial load
  stateData.$glass = $('#glass');
  stateData.$pause = $('#pause');
  stateData.$player = $('#player').detach(); // detach when it's not active
  stateData.$enemySpace = $('#enemy-space');
  stateData.$bonusSpace = $('#bonus-space');
  stateData.$playerSpace = $('#player-space');
  stateData.$bulletSpace = $('#projectile-space');
  stateData.$instructions = $('#instructions');
}

// Start the game
const startNewGame = () => {
  // Reset the state data
  resetState();
  // Indicate we have started a game
  stateData.inGame = true;
  // disable the main buttons while in an active game
  setMainButtonsDisabled(true);
  // Indicate that a cutscene is running
  beginCutscene();
  $cutsceneActors.push(stateData.$player);
  // Move the player into position
  playerEnter();
}

// Start a cutscene that the player can't change
const beginCutscene = () => {
  // Only if not already in a cutscene
  if (!stateData.cutscene) {
    // Update the state
    stateData.cutscene = true;
    // Freeze everything but cutscene actors
    toggleGamePaused(true);
  }
}

// Return to a normal play state
const endCutscene = () => {
  // Only if already in a cutscene
  if (stateData.cutscene) {
    // Resume the normal gameplay
    toggleGamePaused(true);
    // Clean out the $cutsceneActors array
    clearArray($cutsceneActors);
    // Update the state
    stateData.cutscene = false;
  }
}

// Set the animation state for all of the sprites
const updateAnimationState = () => {
  // All the places where sprites might live
  let spriteLocations = [stateData.$enemySpace, stateData.$bonusSpace, stateData.$bulletSpace];
  // Check all locations
  for (let i=0; i<spriteLocations.length; i++) {
    // Get the list of sprites in this location
    let $children = spriteLocations[i].children();
    for (let idx=0; idx<$children.length; idx++) {
      // Pause or unpause animation based on pause state
      if (stateData.gamePaused) {
        $children.eq(idx).addClass('paused');
      } else {
        $children.eq(idx).removeClass('paused');
      }
    }
  }
  // Modify any misc sprite animations
  for (let idx=0; idx<$miscSprites.length; idx++) {
    // Pause or unpause animation based on pause state
    if (stateData.gamePaused) {
      $miscSprites[idx].addClass('paused');
    } else {
      $miscSprites[idx].removeClass('paused');
    }
  }
}

// Player wants to pause the game
const playerPressedPauseKey = () => {
  if (stateData.cutscene) {
    // The player is pausing a cutscene
    for (let idx=0; idx<$cutsceneActors.length; idx++) {
      $cutsceneActors[idx].toggleClass('paused');
    }
    // Toggle the popup screens
    if (!isPopupVisible(stateData.$pause)) {
      // Show the pause screen and enable the buttons
      showPopup(stateData.$pause);
      setMainButtonsDisabled(false);
    } else {
      // Clear the screens and disable the buttons
      hideAllPopups();
      setMainButtonsDisabled(true);
    }
  } else {
    // The player is pausing the game
    toggleGamePaused(false);
  }
}

// Pause or unpause the game
const toggleGamePaused = (isCutsceneFreeze) => {
  if (stateData.gamePaused) {
    // Game is paused, resume it (harmless if the class is already there)
    hideAllPopups();
    // Have the glass layer listen for mouse moves and clicks
    stateData.$glass.on('mousemove', movePlayer);
    // Start the collision detection timer
    stateData.collisionDetectionTimer = setInterval(checkForCollisions, 100);
    // Update the paused state
    stateData.gamePaused = false;
    // disable the main buttons
    setMainButtonsDisabled(true);
    // Resume all of the sprite animations
    updateAnimationState();
  } else {
    // Only put up the pause screen if this isn't a cutscene
    if (!isCutsceneFreeze) {
      // Game is running, pause it
      showPopup(stateData.$pause);
      // Re-enable the main buttons
      setMainButtonsDisabled(false);
    }
    // Stop the collision detection timer
    clearInterval(stateData.collisionDetectionTimer);
    // Stop the glass layer from listening for mouse moves
    stateData.$glass.off('mousemove', movePlayer);
    // Update the paused state
    stateData.gamePaused = true;
    // Pause all of the sprite animations
    updateAnimationState();
  }
}

// Listen for escape key events to trigger pause function
const keyListener = (event) => {
  // Only handle key events if we are in a game
  if (stateData.inGame) {
    if (event.keyCode === constants.spaceKey) {
      if (!stateData.gamePaused) {
        // Pressed space while the game was running outside of a cutscene
        fireWeapon();
      }
    } else if (event.keyCode === constants.escapeKey) {
      // toggle the paused state
      playerPressedPauseKey();
    }
    return false;
  }
}

// Test if a popup screen is currently visible
const isPopupVisible = ($screen) => {
  return !$screen.hasClass('hidden');
}

// Show onw of the popup screens
const showPopup = ($screen) => {
  $screen.removeClass('hidden');
}

// Show onw of the popup screens
const hidePopup = ($screen) => {
  $screen.addClass('hidden');
}

// Hide all of the popup screens
const hideAllPopups = () => {
  $('.popup').each((idx, popup)=>{
    $(popup).addClass('hidden');
  });
}

// Open the settings page
const openSettings = () => {

}

// Open the game instructions page
const toggleInstructions = () => {
  let $instructions = $('#instructions');
  if (isPopupVisible($instructions)) {
    hidePopup($instructions);
  } else {
    showPopup($instructions);
  }
}

// To run after page loads
const runOnReady = () => {
  // Perform the one-time state init
  stateInit();
  // Make sure we know how big things are
  populateSizeData();
  // Add the global button listeners
  $('#btn-restart').on('click', startNewGame);
  $('#btn-settings').on('click', openSettings);
  $('#btn-instruct').on('click', toggleInstructions);
  // Handle window resizes
  $(window).on('resize', populateSizeData);
  // Handle key presses
  $(document).on('keyup', keyListener);
}

// Run when the page is done loading
$(runOnReady);
