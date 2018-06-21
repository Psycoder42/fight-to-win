// Object to store static values
const constants = {
  playerWidth: 50,
  playerHeight: 64,
  escapeKey: 27,
  spaceKey: 32
};
// Game settings
const settings = {
  gameMode: 'campaign',
  musicMuted: false,
  soundEffectsMuted: false
}
// The random grab bag that makes up the enemys and their behavior
const enemyOps = {
  type: ['grey', 'red', 'green'],
  bullets: ['ani-ebullet-normal', 'ani-ebullet-fast'],
  style: ['ani-enemy','ani-enemy-fast'],
  modifiers: ['ease-in','ease-out'],
  endpoints: ['a','b','c','d','e','f','g','h']
};
// Array to store all the possible power ups
const powerUps = [
  {name: 'expand-shot', skin: 'expand', quantity: 10, fireDelay: 500, modifierType: 'weapon', modifierClass: 'ani-pbullet-expand'},
  {name: 'speed-shot', skin: 'speed', quantity: 10, fireDelay: 200, modifierType: 'weapon', modifierClass: 'ani-pbullet-speed'},
  {name: 'shields', skin: 'shield', modifierType: 'ship'},
  {name: 'invulnerable', skin: 'immune', modifierType: 'ship'},
  {name: 'points', skin: 'points', modifierType: 'state'},
  {name: 'life', skin: 'life', modifierType: 'state'}
];
// Object to store game state data
const stateData = {
  // This is defined here because it shouldn't be reset on a new game
  highScore: 0
};
// Information about the attack waves durring the campaign
const waveData = [
  { enemyCount: 6, spawnDelay: 2000, tagline: "Those guys don't look frendly" },
  { enemyCount: 10, spawnDelay: 2000, tagline: "Here come some more" },
  { enemyCount: 15, spawnDelay: 1500, tagline: "I think we made them angry" },
  { enemyCount: 20, spawnDelay: 1500, tagline: "Oh God, they're everywhere" },
  { enemyCount: 30, spawnDelay: 1000, tagline: "Not on my watch" }
];
const imgData = {}; // Object holding all of the source image locations
const divData = {}; // Object to store div references
const sizeData = {}; // Object to store information that might change on resize
const timeoutMap = {}; // Object to keep track of all the active timeouts
const activeBonuses = []; // Array to bonuses currently applied to the player
const $pCollidables = []; // Array to store things the player can shoot
const $pProjectiles = []; // Array to store players fired projectiles
const $eProjectiles = []; // Array to store enemy projectiles
const $miscSprites = []; // Array to store other pausable sprites
const $cutsceneActors = []; // Array to store actors in a cutscene

// Load all of the images asyncronously
const loadImages = () => {
  imgData.$player = $('<img>').attr('src', 'images/player.png');
  imgData.$greyEnemy = $('<img>').attr('src', 'images/enemy0.png');
  imgData.$redEnemy = $('<img>').attr('src', 'images/enemy1.png');
  imgData.$greenEnemy = $('<img>').attr('src', 'images/enemy2.png');
  imgData.$explosion = $('<img>').attr('src', 'images/fireball.png');
  imgData.$lifeBonus = $('<img>').attr('src', 'images/pu-life.png');
  imgData.$pointsBonus = $('<img>').attr('src', 'images/pu-points.png');
  imgData.$shieldBonus = $('<img>').attr('src', 'images/pu-shield.png');
  imgData.$immuneBonus = $('<img>').attr('src', 'images/pu-immune.png');
  imgData.$expandBonus = $('<img>').attr('src', 'images/pu-expand.png');
  imgData.$speedBonus = $('<img>').attr('src', 'images/pu-speed.png');
}
// We want to run this immediately and not wait for the page to load
loadImages();

// Load all the sounds
const sounds = {
  effects: new Howl({
    src: ['sounds/effects.ogg'],
    sprite: {
      swoosh: [0, 85],
      click: [100, 225],
      softBeep: [350, 110],
      explode: [500, 1800],
      energyShot: [2400, 500]
    }
  }),
  music: new Howl({
    src: ['sounds/bg.ogg'],
    loop: true,
    volume: 0.2
  })
}

// This only needs to happen once
const divInit = () => {
  // Initialize the state data that will never change after initial load
  divData.$glass = $('#glass');
  divData.$pause = $('#pause');
  divData.$player = $('#player').detach(); // detach when it's not active
  divData.$enemySpace = $('#enemy-space');
  divData.$bonusSpace = $('#bonus-space');
  divData.$playerSpace = $('#player-space');
  divData.$bulletSpace = $('#projectile-space');
  divData.$instructions = $('#instructions');
  divData.$settings = $('#settings');
  divData.$playerKills = $('#player-kills');
  divData.$playerScore = $('#player-score');
  divData.$highScore = $('#high-score');
  divData.$waveNumber = $('#wave-number');
  divData.$extraLives = $('#extra-lives');
  divData.$effectInsertLoc = $('#sidebar-stats > .spacer');
  divData.$stageMessages = $('#stage-messages');
  // A special jQuery object for custom events
  divData.$customEvents = $('<div>');
}

// Reset the state data back to the defaults (anything that could have changed)
const resetState = () => {
  // boolean states
  stateData.inGame = false;
  stateData.inWave = false;
  stateData.canFire = true;
  stateData.cutscene = false;
  stateData.gamePaused = false;
  stateData.pausableCutscene = true;
  stateData.playerHasShield = false;
  stateData.playerInvulnerable = false;
  // counter states
  stateData.currentWave = 0;
  stateData.playerKills = 0;
  stateData.playerScore = 0;
  stateData.nextBulletId = 0;
  stateData.powerShotsRemaining = 0;
  stateData.livesRemaining = 2; // 2 additional lives: 3 total
  stateData.enemiesSpawned = 0; // For tracking wave status
  stateData.enemiesKilled = 0; // For tracking wave status
  // string states
  stateData.powerShotName = null;
  stateData.powerShotClass = null;
  // misc
  stateData.firingDelay = 500;
  stateData.currentWaveInfo = null;
  stateData.collisionDetectionTimer = null;
  stateData.enemySpawnBonusChance = .25;
  // Clean up objects and UI
  resetObjectStates();
  resetUI();
}

// Keep track of things that might change if the screen size changes
const populateSizeData = () => {
  sizeData.glassBounds = rect(divData.$glass);
}

// Helper function to make sure a display string is not null
const getDisplayString = (str) => {
  return (str == null ? '' : str);
}

// Helper method to get a unique (enough) id
const getUniqueId = (prefix='id_') => {
  let d = new Date();
  return prefix + d.getTime();
}

// Remove all the elements in an array
const clearArray = (array) => {
  if (array!=null && array instanceof Array) {
    while (array.length > 0) array.pop();
  }
}

// Remove all the elements in an array and remove them from the dom
const clearDisplayableArray = (array) => {
  if (array!=null && array instanceof Array) {
    while (array.length > 0) array.pop().remove();
  }
}

// Remove all the keys in an object
const clearObject = (obj) => {
  if (obj != null) {
    let keys = Object.keys(obj);
    for (let key of keys) delete obj[key];
  }
}

// Set the animation state for all of the sprites
const ensureSpritesAreRemoved = () => {
  // All the places where sprites might live
  let spriteLocations = [divData.$enemySpace, divData.$bonusSpace, divData.$bulletSpace];
  // Check all locations
  for (let i=0; i<spriteLocations.length; i++) {
    // Get the list of sprites in this location
    let $children = spriteLocations[i].children();
    // Remove all of them
    for (let j=$children.length-1; j>=0; j--) $children.eq(j).remove();
  }
  // Remove any misc sprite animations
  for (let idx=0; idx<$miscSprites.length; idx++) $miscSprites[idx].remove();
}

// Reset the arrays and objects appropriately
const resetObjectStates = () => {
  // Stop all of the timeouts
  let keys = Object.keys(timeoutMap);
  for (let key of keys) clearTimeout(timeoutMap[key]);
  clearObject(timeoutMap);
  // Remove all sprites from the game
  for (let $array of [$pCollidables,$pProjectiles,$eProjectiles,$miscSprites]) {
    clearDisplayableArray($array);
  }
  ensureSpritesAreRemoved();
  // Clean out without doing anything with the elements
  clearArray($cutsceneActors);
  clearArray(activeBonuses);
}

// Update the Active Effects list
const updateEffectsList = () => {
  // Remove any existing effects in the list
  $('#sidebar-stats > h4').each((idx, elem)=> { $(elem).remove(); });
  // Add the items in the array to the list
  for (let elem of activeBonuses) {
    $('<h4>').text(elem).insertBefore(divData.$effectInsertLoc);
  }
}

// Update extra lives list
const updateExtraLives = (amount) => {
  // Adjust the number of lives remaining
  stateData.livesRemaining += amount;
  // Make sure to start from a blank slate
  let $extraLives = divData.$extraLives.children();
  $extraLives.each((idx, elem)=>{ $(elem).remove(); });
  // Add the appropriate number back
  for (let i=0; i<stateData.livesRemaining; i++) {
    let $life = $('<img>').addClass('extra-life')
        .attr('src',imgData.$player.attr('src'))
        .css('width','40px').css('height','100%');
    divData.$extraLives.append($life);
  }
}

// Update the player's kill count
const updateKillCount = (amount=1) => {
  // Update the game state
  stateData.playerKills += amount;
  // Update the UI
  divData.$playerKills.text(stateData.playerKills);
}

// Update the player's score
const updatePlayerScore = (amount) => {
  // Update the game state
  stateData.playerScore += amount;
  // Update the UI
  divData.$playerScore.text(stateData.playerScore);
}

// Update the high score
const updateHighScore = () => {
  // Update the game state
  if (stateData.highScore < stateData.playerScore) {
    stateData.highScore = stateData.playerScore;
  }
  // Update the UI
  divData.$highScore.text(stateData.highScore);
}

// Update the player's score
const updateWaveNumber = (reset=false) => {
  if (reset) {
    stateData.currentWave = 0;
    divData.$waveNumber.text('------');
  } else {
    stateData.currentWave++;
    divData.$waveNumber.text('Wave '+stateData.currentWave);
  }
}

// Reset the UI elements
const resetUI = () => {
  // Hide all of the popup screens
  hideAllPopups();
  // Reset the wave
  updateWaveNumber(true);
  // Reset the kills and score
  updateKillCount(0);
  updatePlayerScore(0);
  // Reset the effects list
  updateEffectsList();
  // Reset the extra lives
  updateExtraLives(0);
}

// Helper function to generate a random boolean
const flipCoin = () => {
  return (Math.trunc(Math.random()*2)%2 == 0);
}

// Helper method to determine the game mode
const gameModeIfinite = () => {
  return (settings.gameMode == 'infinite');
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
    let $bToRemove = [];
    for (let $eBullet of $eProjectiles) {
      if (boundsOverlap($eBullet, divData.$player)) {
        $eBullet.detach();
        $bToRemove.push($eBullet);
        if (stateData.playerHasShield) {
          // Shield protected the player
          divData.$player.removeClass('shield');
          stateData.playerHasShield = false;
          // Remove the effect from the list
          trackPowerUp('shields', false);
          continue;
        } else {
          // Player was hit by an enemy bullet
          playerWasHit = true;
          break;
        }
      }
    }
    // Clean any bullets that made contact
    for (let $bullet of $bToRemove) cleanObjectFormArrayAndDOM($bullet, $eProjectiles);
    // Register the player being hit
    if (playerWasHit) playerDied();
  }
  // Check of any of the player bullets hit anything
  let $bToRemove = [];
  for (let bi=0; bi<$pProjectiles.length; bi++) {
    let $bullet = $pProjectiles[bi];
    let $cToRemove = null;
    for (let ci=0; ci<$pCollidables.length; ci++) {
      let $target = $pCollidables[ci];
      if (boundsOverlap($bullet, $target)) {
        // A player bullet hit something
        // Stop showing the bullet on the DOM
        $bullet.detach();
        // We can't use the cleanObjectFormArray function because we are iterating over the array
        $cToRemove = $target;
        $bToRemove.push($bullet);
        // Do additional actions based on what was hit
        bulletImpact($target);
        // this bullet is used so break out of inner loop
        break;
      }
    }
    // If something was hit, remove it from the collision tracking array
    if ($cToRemove != null) cleanObjectFormArray($cToRemove, $pCollidables);
  }
  // Clean up the bullet collision tracking array
  for (let $bullet of $bToRemove) cleanObjectFormArray($bullet, $pProjectiles);
}

// Make sure an object is cleaned  out of the collision array
const cleanObjectFormArray = ($obj, $array=null) => {
  if ($array != null) {
    let objId = $obj.attr('data-id');
    let idx = $array.findIndex(($o)=>{ return $o.attr('data-id') == objId; });
    if (idx > -1) $array.splice(idx, 1);
  }
  // If a wave is now over and there is nothing left for the player to
  // interact with, trigger the wave:end event
  if (stateData.inWave &&
      stateData.enemiesSpawned==stateData.currentWaveInfo.enemyCount &&
      stateData.enemiesKilled==stateData.enemiesSpawned &&
      $pCollidables.length==0 &&
      $eProjectiles.length==0)
  {
    divData.$customEvents.trigger('wave:end');
  }
}

// Make sure an object is cleaned off the DOM and the collision array
const cleanObjectFormArrayAndDOM = ($obj, $array=null) => {
  $obj.remove();
  cleanObjectFormArray($obj, $array);
}

// Add or subtract an active powerup
const trackPowerUp = (name, addPowerUp) => {
  let idx = activeBonuses.indexOf(name);
  if (addPowerUp) {
    // Player has gained a power up
    if (idx == -1) {
      // Only add it if it wasn't already there
      activeBonuses.push(name);
    }
  } else {
    // Power up has worn off or been depleted
    if (idx != -1) {
      // Only remove if present
      activeBonuses.splice(idx, 1);
    }
  }
  // Update the UI
  updateEffectsList();
}

// Apply a power up
const applyPowerUp = (index) => {
  let info = powerUps[parseInt(index)];
  if (info.modifierType == 'weapon') {
    // A new shot type will replace an old one
    trackPowerUp(stateData.powerShotName, false);
    stateData.powerShotName = info.fireDelay;
    stateData.powerShotName = info.name;
    stateData.powerShotClass = info.modifierClass;
    stateData.powerShotsRemaining = info.quantity;
    trackPowerUp(info.name, true);
  } else if (info.modifierType == 'ship') {
    switch (info.name) {
      case 'invulnerable':
        makePlayerInvulnerable();
        break;
      case 'shields':
        stateData.playerHasShield = true;
        divData.$player.addClass('shield');
        break;
    }
    trackPowerUp(info.name, true);
  } else if (info.modifierType == 'state') {
    switch (info.name) {
      case 'points':
        // Award a random points - multiple of 50 between 100-1000
        updatePlayerScore(((Math.floor(Math.random()*19) + 1) * 50));
        break;
      case 'life':
        // The player gains an extra life
        updateExtraLives(1);
        break;
    }
  }
}

// Handle a player bullet hitting something
const bulletImpact = ($target) => {
  // Add a class to let us identify destroyed objects
  $target.addClass('destroyed');
  // Decide what to do based on what was hit
  if ($target.attr('data-id').startsWith('e')) {
    // An enemy was hit
    enemyWasDestroyed($target);
  } else {
    // The only other thing to hit is a powerup
    $target.detach();
    applyPowerUp($target.attr('data-pu-idx'));
    cleanObjectFormArrayAndDOM($target, $pCollidables);
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
  // Track the kill
  updateKillCount();
  updatePlayerScore(250);
  // Blow up the enemy
  makeExplode($enemy, benefitFromDeadEnemy);
}

// Final interaction with defeated enemy
const benefitFromDeadEnemy = ($enemy) => {
  // Increase the player score and spawn bonuses and stuff
  let spawn = $enemy.attr('data-pu-spawn');
  if (spawn != null) {
    if (spawn == 'random') {
      spawnPowerUp();
    } else {
      spawnPowerUp(parseInt(spawn));
    }
  }
  // Cleanup the enemy
  stateData.enemiesKilled++;
  cleanObjectFormArrayAndDOM($enemy, $pCollidables);
}

// Display an explosion on a sprite
// After the explosion animation is complete, if a callback was provided it
// will be invoked and the sprite that exploded will be passed as an argument
const makeExplode = ($sprite, callback=null, animationNumber=1) => {
  // Spawn the explosion on the center of the sprite
  let spriteRect = rect($sprite);
  let $explosion = $('<img>').addClass('explosion')
      .attr('src', imgData.$explosion.attr('src'))
      .css('top', (spriteRect.halfHeight-40)+'px')
      .css('left', (spriteRect.halfWidth-40)+'px')
      // Add an id so that it is easier to identify
      .attr('data-id', getUniqueId('a-'))
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
  // Play the sound
  playSoundInstance(sounds.effects, 'explode', 0.2);
  // Start the animation
  $explosion.addClass('ani-explosion-'+animationNumber);
}

// Handle a player getting hit by a bullet
const playerDied = (target) => {
  // This is a cutscene so freese the gameplay
  beginCutscene();
  $cutsceneActors.push(divData.$player);
  // Default callback is to spawn the next life
  let callback = spawnNextLife;
  if (stateData.livesRemaining == 0) {
    // Manually update pausableCutscene in this case
    stateData.pausableCutscene = false;
    // The player is out of lives
    callback = playerOutOfLives;
  }
  // Have the player explode
  makeExplode(divData.$player, callback);
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
  // Shortcut if we've spawned all the enemies for this wave
  if (stateData.enemiesSpawned >= stateData.currentWaveInfo.enemyCount) {
    clearInterval(timeoutMap['enemySpawnInterval']);
    return;
  }
  if (!stateData.gamePaused) {
    // Only spawn if the game is not paused
    let eType = enemyOps.type[Math.floor(Math.random()*enemyOps.type.length)];
    let eClass = 'enemy-' + eType;
    let eSkin = imgData['$'+eType+'Enemy'];
    let eStyle = enemyOps.style[Math.floor(Math.random()*enemyOps.style.length)];
    let eMod = enemyOps.modifiers[Math.floor(Math.random()*enemyOps.modifiers.length)];
    let eDest = enemyOps.endpoints[Math.floor(Math.random()*enemyOps.endpoints.length)];
    let eAmmo = enemyOps.bullets[Math.floor(Math.random()*enemyOps.bullets.length)];
    let xPos = (Math.floor(Math.random()*50)+20);
    let hasBonus = (Math.random() <= stateData.enemySpawnBonusChance);
    let enemyId = getUniqueId('e-');
    // Generate the new enemy
    let $enemy = $('<div>').addClass(eClass).addClass('reusable-sprite')
        // Add an id so that it is easier to identify
        .attr('data-id', enemyId)
        // Add the types of bullets this enemy uses
        .attr('data-bullet-type', eAmmo)
        // Set its spawn point
        .css('top', '-50px')
        .css('left', xPos+'%')
        // Add the enemy skin into the div
        .append($('<img>').attr('src',eSkin.attr('src')));
    if (hasBonus) {
      // This enemy will spawn a bonus when killed
      $enemy.attr('data-pu-spawn', 'random');
    }
    // Attach it to the DOM
    divData.$enemySpace.append($enemy);
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
  // Vertical start is around 40 (+/-30)
  let yPos = 40 + (Math.floor(Math.random()*61)-30);
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
      .attr('data-id', getUniqueId('pu-'))
      // Add powerup info to div for later user
      .attr('data-pu-idx', pIdx)
      // Center it at the spawn point
      .css('top', spawnInfo.y+'px')
      .css('left', spawnInfo.x+'px')
      // Add the bonus skin into the div
      .append($('<img>').attr('src', imgData['$'+powerUpInfo.skin+'Bonus'].attr('src')))
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
  divData.$bonusSpace.append($powerUp);
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
      .attr('data-id', getUniqueId('b-'))
      // Center it at the spawn point
      .css('top', Math.round(spawnPoint.y-5)+'px')
      .css('left', Math.round(spawnPoint.x-5)+'px')
      // Have it remove itself from the DOM when the animation ends
      .on('oanimationend animationend webkitAnimationEnd', null, {array: $pProjectiles}, cleanupIndependentSprite);
  // Attach it to the DOM
  divData.$bulletSpace.append($projectile);
  // Make sure this honors the pause state
  if (stateData.gamePaused) $projectile.addClass('paused');
  // Start the animation
  let bulletAni = "ani-pbullet-normal";
  if (stateData.powerShotsRemaining > 0) {
    bulletAni = stateData.powerShotClass;
    stateData.powerShotsRemaining--;
    if (stateData.powerShotsRemaining == 0) {
      // Ran out of power shots so remove the bonus from the list
      trackPowerUp(stateData.powerShotName, false);
      // Reset to the default firing delay
      stateData.firingDelay = 500;
    }
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
        .attr('data-id', getUniqueId('b-'+stateData.nextBulletId++))
        // Center it at the spawn point
        .css('top', Math.round(spawnPoint.y-5)+'px')
        .css('left', Math.round(spawnPoint.x-5)+'px')
        // Have it remove itself from the DOM when the animation ends
        .on('oanimationend animationend webkitAnimationEnd', null, {array: $eProjectiles}, cleanupIndependentSprite);
    // Attach it to the DOM
    divData.$bulletSpace.append($projectile);
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
    // Play the sound
    playSoundInstance(sounds.effects, 'energyShot');
    // Fire the weapon
    firePlayerWeapon(getProjectileSpawnPoint(divData.$player, true));
    // Set a timeout to re-enable firing after .5 seconds
    setTimeout(()=>{ stateData.canFire=true; }, stateData.firingDelay);
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
  // Randomly modify movement
  $enemy.removeClass(enemyOps.modifiers.join(' '));
  if (flipCoin()) {
    $enemy.addClass(enemyOps.modifiers[Math.floor(Math.random()*enemyOps.modifiers.length)]);
  }
  // Start the animation
  $enemy.css('animation-name', nextLoc);
}

// Make the player ship move with the mouse's horizontal position
const movePlayer = (event) => {
  // Only move player when enemies are around
  if (stateData.inWave) {
    // Get the position of the mouse relative to the glass div
    let xPos = event.clientX - sizeData.glassBounds.left;
    // Make sure the ship doesn't leave the left side of the screen
    xPos = Math.max(10, xPos);
    // Make sure the ship doesn't leave the right side of the screen
    let rightEdge = sizeData.glassBounds.width-constants.playerWidth;
    xPos = Math.min(xPos, rightEdge-10);
    // Reposition the player's ship
    divData.$player.css('left', Math.round(xPos)+'px');
  }
}

// Player ship enters the screen
const playerEnter = (callback=null) => {
  // Move the player ship to the starting point
  let glassBounds = rect(divData.$glass);
  let midGlass = glassBounds.xMid - sizeData.glassBounds.left;
  divData.$player.css('top','80px')
      .css('left', Math.round(midGlass-(constants.playerWidth/2))+'px')
      // When the animation complete, end the cutscene
      .on('oanimationend animationend webkitAnimationEnd', null, {callback: callback}, playerEnterCallback);
  // Add the player into the player-space div (it was detached)
  divData.$playerSpace.append(divData.$player);
  // Start the animation
  divData.$player.addClass('ani-player-enter');
}

// Make the player invulnerable
const makePlayerInvulnerable = () => {
  // Only if the player is not already invulnerable
  if (!stateData.playerInvulnerable) {
    divData.$player.on('oanimationend animationend webkitAnimationEnd', makePlayerInvulnerableCallback);
    // Update the state
    stateData.playerInvulnerable = true;
    // Start the invulnerable animation
    divData.$player.addClass('ani-invulnerable');
  }
}

// Bring in the next ship after a player death
const spawnNextLife = () => {
  // Take away one of their extra lives
  updateExtraLives(-1);
  // Bring the next ship in and make them temporarily invulnerable
  playerEnter(makePlayerInvulnerable);
}

// Start the enemy attact for this wave
const startEnemyAttack = () => {
  // Reset the spawned/killed enemy count
  stateData.enemiesSpawned = 0;
  stateData.enemiesKilled = 0;
  stateData.inWave = true;
  // Start an interval timer to spawn enemies
  timeoutMap['enemySpawnInterval'] = setInterval(spawnEnemy, stateData.currentWaveInfo.spawnDelay)
}

// The wave is over
const waveOver = () => {
  // Update the state
  stateData.inWave = false;
  // Remove all of the player bullets from the screen
  clearDisplayableArray($pProjectiles);
  // Start the next wave or show the win screen
  if (gameModeIfinite() || stateData.currentWave < waveData.length) {
    startNextWave();
  } else {
    // Make sure everything is stopped
    beginCutscene(false);
    // All the waves have been completed
    displayText('CONGRATULATIONS',
      'You have defeated all of the enemies',
      'The universe is safe... for now',
      5000,
      gameOver
    );
  }
}

// The player dies and has no more lives
const playerOutOfLives = () => {
  // All the waves have been completed
  displayText('Game Over',
    'You succumbed to the invading horde',
    'Perhaps someday a warrior will appear who can pick up where you left off',
    5000,
    gameOver
  );
}

// The screen to display after the game is over
const displayEndScreen = () => {
  // Prime the message screen
  setPopupMessage("Thanks for Playing!", '', "Remember, winners don't do drugs!");
  // Show the message screen
  showPopup(divData.$stageMessages);
  // Give the cursor back
  divData.$glass.addClass('show-cursor');
}

// The game is over
const gameOver = () => {
  // Detatch the player
  divData.$player.detach();
  // Remove all of the potentially visible sprites
  resetObjectStates();
  // Indicate we are no longer in a game
  stateData.inGame = false;
  // Re-enable the main buttons
  setMainButtonsDisabled(false);
  // Show the end screen
  displayEndScreen();
  // Adjust the highscore data if necessary
  updateHighScore();
  // Stop the music
  sounds.music.stop();
}

// Alter the enablement state of the main window buttons
const setMainButtonsDisabled = (isDisabled) => {
  $('#sidebar-controls > .button').each((idx, button)=>{
    $(button).prop('disabled',isDisabled);
  });
}

// Set the message for the stage dialog
const setPopupMessage = (title, subtitle, text) => {
  divData.$stageMessages.find('.title').text(getDisplayString(title));
  divData.$stageMessages.find('.subtitle').text(getDisplayString(subtitle));
  divData.$stageMessages.find('.text').text(getDisplayString(text));
}

// Display text for a few seconds before invoking a callback
const displayText = (title, subtitle, text, time, callback) => {
  // Prime the message screen
  setPopupMessage(title, subtitle, text);
  // Show the message screen
  showPopup(divData.$stageMessages);
  // Display it for the desired time (mimic a event object to pass to the callback)
  setTimeout(displayTextCallback, time, { data: { callback: callback } });
}

// Start the next wave
const startNextWave = () => {
  // Make sure nothing is moving
  beginCutscene(false);
  // Get the wave data
  if (gameModeIfinite()) {
    // Generate the next waveInfo
    stateData.currentWaveInfo = {
      enemyCount: 8+(8*stateData.currentWave),
      spawnDelay: Math.max(500, 2000-(100*stateData.currentWave)),
      tagline: '-- Infinite Mode --'
    }
  } else {
    stateData.currentWaveInfo = waveData[stateData.currentWave];
  }
  // Increment the currentWave counter and update the UI
  updateWaveNumber();
  // Display the wave and tagline then start the wave
  displayText('Wave '+stateData.currentWave, stateData.currentWaveInfo.tagline, '', 3000, ()=>{
    endCutscene();
    startEnemyAttack();
  });
}

// Start the game
const startNewGame = () => {
  // Reset the state data
  resetState();
  // Indicate we have started a game
  stateData.inGame = true;
  // disable the main buttons while in an active game
  setMainButtonsDisabled(true);
  // Hide the cursor
  divData.$glass.removeClass('show-cursor');
  // Determine the gameMode
  settings.gameMode = $('input[name=gamemode]:checked').val();
  // (Re)start the background music
  beginMusic();
  // Indicate that a cutscene is running
  beginCutscene();
  $cutsceneActors.push(divData.$player);
  // Move the player into position
  playerEnter(startNextWave);
}

// Stop (if playing) then restart the background music
const beginMusic = () => {
  // Stop and reset the music
  sounds.music.stop();
  // Start it again
  sounds.music.play();
  // Honor the mute settings
  sounds.music.mute(settings.musicMuted);
};

// Start a cutscene that the player can't change
const beginCutscene = (pausable=true) => {
  // Only if not already in a cutscene
  if (!stateData.cutscene) {
    // Update the state
    stateData.cutscene = true;
    stateData.pausableCutscene = pausable;
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
  let spriteLocations = [divData.$enemySpace, divData.$bonusSpace, divData.$bulletSpace];
  // Check all locations
  for (let i=0; i<spriteLocations.length; i++) {
    // Get the list of sprites in this location
    let $children = spriteLocations[i].children();
    for (let idx=0; idx<$children.length; idx++) {
      let $sprite = $children.eq(idx)
      // Pause or unpause animation based on pause state
      if (stateData.gamePaused) {
        $sprite.addClass('paused');
      } else {
        if (!$sprite.hasClass('destroyed')) {
          // Only resume live sprites
          $sprite.removeClass('paused');
        }
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
    // Only interrupt pausable cutscenes
    if (stateData.pausableCutscene) {
      // The player is pausing a cutscene
      for (let idx=0; idx<$cutsceneActors.length; idx++) {
        $cutsceneActors[idx].toggleClass('paused');
      }
      // Toggle the popup screens
      if (!isPopupVisible(divData.$pause)) {
        // Show the pause screen and enable the buttons
        showPopup(divData.$pause);
        setMainButtonsDisabled(false);
      } else {
        // Clear the screens and disable the buttons
        hideAllPopups();
        setMainButtonsDisabled(true);
      }
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
    divData.$glass.on('mousemove', movePlayer);
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
      showPopup(divData.$pause);
      // Re-enable the main buttons
      setMainButtonsDisabled(false);
    }
    // Stop the collision detection timer
    clearInterval(stateData.collisionDetectionTimer);
    // Stop the glass layer from listening for mouse moves
    divData.$glass.off('mousemove', movePlayer);
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
      if (stateData.inWave && !stateData.gamePaused) {
        // Pressed space while the game was running outside of a cutscene
        fireWeapon();
        return false;
      }
    } else if (event.keyCode === constants.escapeKey) {
      // toggle the paused state
      playerPressedPauseKey();
      return false;
    }
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

//  Toggle the game settings page
const toggleSettings = () => {
  if (isPopupVisible(divData.$settings)) {
    hidePopup(divData.$settings);
  } else {
    hidePopup(divData.$instructions);
    showPopup(divData.$settings);
  }
}

//  Toggle the game instructions page
const toggleInstructions = () => {
  if (isPopupVisible(divData.$instructions)) {
    hidePopup(divData.$instructions);
  } else {
    hidePopup(divData.$settings);
    showPopup(divData.$instructions);
  }
}

// Close the popup where the button was pressed
const popupClosed = (event) => {
  // Hide the ancestor with the popup class
  $(event.currentTarget).closest('.popup').addClass('hidden');
  // Prevent any default behavior
  return false;
}

// Play a sound for a button
const playButtonSound = (event) => {
  if (!$(event.currentTarget).prop('disabled')) {
    playSoundInstance(event.data.sound, event.data.clip);
  }
}

// Play an instance of a sound
const playSoundInstance = (soundSprite, clip=null, volume=1.0) => {
  if (!settings.soundEffectsMuted) {
    let soundId = null;
    if (clip == null) {
      soundId = soundSprite.play();
    } else {
      soundId = soundSprite.play(clip);
    }
    soundSprite.volume(volume, soundId);
  }
}

// Toggle the sounds
const toggleSound = (event) => {
  settings.soundEffectsMuted = $(event.currentTarget).prop('checked');
  sounds.effects.mute(settings.soundEffectsMuted);
}

// Mute the background music
const muteMusic = (event) => {
  settings.musicMuted = $(event.currentTarget).prop('checked');
  sounds.music.mute(settings.musicMuted);
}

// To run after page loads
const runOnReady = () => {
  // Perform the one-time state init
  divInit();
  // Add the player image to the div
  divData.$player.append($('<img>').attr('src', imgData.$player.attr('src')));
  // Make sure the wave end listener is defined
  divData.$customEvents.on('wave:end', waveOver);
  // Make sure we know how big things are
  populateSizeData();
  // Attach sounds
  $('.button').on('mouseenter', {sound: sounds.effects, clip: 'softBeep'}, playButtonSound);
  $('.button').on('click', {sound: sounds.effects, clip: 'click'}, playButtonSound);
  // Add the global button listeners
  $('.popup-close').on('click', popupClosed);
  $('#btn-restart').on('click', startNewGame);
  $('#btn-settings').on('click', toggleSettings);
  $('#btn-instruct').on('click', toggleInstructions);
  $('#mute-music').prop('checked', settings.musicMuted)
      .on('change', {sound: sounds.effects}, muteMusic);
  $('#mute-effects').prop('checked', settings.soundEffectsMuted)
      .on('change', {sound: sounds.effects}, toggleSound);
  // Handle window resizes
  $(window).on('resize', populateSizeData);
  // Handle key presses
  $(document).on('keydown', keyListener);
}

// Run when the page is done loading
$(runOnReady);
