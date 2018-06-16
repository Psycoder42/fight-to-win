const sizeData = {}
const stateData = {
  canFire: true
}

const populateSizeData = () => {
  sizeData.glassBounds = $('#glass').clientRect();
  sizeData.playerWidth = 50;
}

// Figure out where the projectile should spawn
const getProjectileSpawnPoint = (originator, isPlayer) => {
  let xPos = 0;
}

// The user attempted to fire their weapon.
const fireWeapon = () => {
  // Only allow firing so often
  if (stateData.canFire) {
    // Temporarily disable firing
    stateData.canFire = false;
    // Fire the weapon
    $('#enemey-space').append('f');
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
  xPos = Math.floor(Math.min(xPos, sizeData.glassBounds.width - sizeData.playerWidth));
  // Reposition the player's ship
  $('#player').css('left',xPos+'px');
}

// To run after page loads
const runOnReady = () => {
    populateSizeData();
    $('#glass').on('mousemove', movePlayer);
    $('#glass').on('click',fireWeapon);
}

// Run when the page is done loading
$(runOnReady);
