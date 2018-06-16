const sizeData = {}
const stateData = {
  canFire: true
}
const constants = {
  playerWidth: 40
}
const powerups = [
  {name: 'test', duration: '2s', modifierType: 'weapon', modifierClass: 'ani-pbullet-expand'}
]
const $pCollidables = [];
const $pProjectiles = [];
const $eProjectiles = [];
let $player = null;
let nextEnemyId = 0;
let nextPowerUpId = 0;
let nextBulletId = 0;

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
    if (boundsOverlap($eBullet, $player)) {
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
        bulletImpact(target); // do additional actions based on what was hit
        cToRemove = ci;
        bToRemove.push(bi);
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
  console.log('Player hit', $target);
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

// Keep track of things that might change if the screen size changes
const populateSizeData = () => {
  sizeData.glassBounds = rect($('#glass'));
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
    .attr('data-id', 'pu-'+nextPowerUpId++)
    // Add powerup info to div for later user
    .attr('data-pu-type', powerUpInfo.modifierType)
    .attr('data-pu-class', powerUpInfo.modifierClass)
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
    .attr('data-id', 'b-'+nextBulletId++)
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
    projectile.addClass("ani-pbullet-normal");
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
    firePlayerWeapon(getProjectileSpawnPoint($player, true));
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
  $player.css('left', Math.round(xPos)+'px');
}

// To run after page loads
const runOnReady = () => {
    $player = $('#player');
    // Make sure we know how big things are
    populateSizeData();
    // If the window is resized, update our sizes
    $(window).on('resize', populateSizeData);
    // Have the glass layer listen for mouse moves and clicks
    $('#glass').on('mousemove', movePlayer);
    $('#glass').on('click',fireWeapon);
    setTimeout(spawnPowerUp, 5000);
    setInterval(checkForCollisions, 100);
}

// Run when the page is done loading
$(runOnReady);
