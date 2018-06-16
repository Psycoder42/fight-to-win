const sizeData = {}
const stateData = {
  canFire: true
}
const constants = {
  playerWidth: 40
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
  let projectile = $('<div>')
    // Center it at the spawn point
    .css('top', Math.round(spawnPoint.y-5)+'px')
    .css('left', Math.round(spawnPoint.x-5)+'px')
    // Have it remove itself from the DOM when the animation ends
    .bind('oanimationend animationend webkitAnimationEnd', (event) => {
       $(event.currentTarget).remove();
    });
    // Attach it to the DOM
    $('#projectile-space').append(projectile);
    // Start the animation
    projectile.addClass("player-bullet");
}

// The user attempted to fire their weapon.
const fireWeapon = () => {
  // Only allow firing so often
  if (stateData.canFire) {
    // Temporarily disable firing
    stateData.canFire = false;
    // Fire the weapon
    firePlayerWeapon(getProjectileSpawnPoint($('#player'), true));
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
  $('#player').css('left', Math.round(xPos)+'px');
}

// To run after page loads
const runOnReady = () => {
    // Make sure we know how big things are
    populateSizeData();
    // If the window is resized, update our sizes
    $(window).on('resize', populateSizeData);
    // Have the glass layer listen for mouse moves and clicks
    $('#glass').on('mousemove', movePlayer);
    $('#glass').on('click',fireWeapon);
}

// Run when the page is done loading
$(runOnReady);
