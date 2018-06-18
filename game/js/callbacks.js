// Callback after an explosion
// The event.data.callback is either null or a function to call
const explosionCallback = (event) => {
  let callback = event.data.callback;
  let $explosion = $(event.currentTarget);
  // Remove the one-time listener
  $explosion.off('oanimationend animationend webkitAnimationEnd', explosionCallback);
  // Assume the explosion is going into the miscSprites array to guarantee it
  // will be cleaned in either case ($cutsceneActors is auto-cleaned)
  cleanObjectFormArrayAndDOM($explosion, $miscSprites);
  // Invoke the post-explosion code
  if (callback != null) {
    // Pass the parent (which is the sprite that exploded) to the callback
    // We need to use a timeout in order to break out of the current "thread"
    setTimeout(callback, 50, $explosion.parent());
  }
}

// Callback after the player's ship enters the game area
// The event.data.callback is either null or a function to call
const playerEnterCallback = (event) => {
  let callback = event.data.callback;
  // Remove this one-time listener
  $(event.currentTarget).off('oanimationend animationend webkitAnimationEnd', playerEnterCallback);
  // Affix the player to its new location
  affixPositionToParent(stateData.$player, stateData.$playerSpace);
  // Remove the animation class
  stateData.$player.removeClass('ani-player-enter');
  // End the cutscene
  endCutscene();
  // Perform the custom action if present
  if (callback != null) {
    // We need to use a timeout in order to break out of the current "thread"
    setTimeout(callback, 50);
  }
}

// Callback after the player is no longer invulnerable
const makePlayerInvulnerableCallback = (event) => {
  // Remove the one-time listener
  $(event.currentTarget).off('oanimationend animationend webkitAnimationEnd', makePlayerInvulnerableCallback);
  // Remove the animation class
  stateData.$player.removeClass('ani-invulnerable');
  // Update the state
  stateData.playerInvulnerable = false;
}

// Cleanup an independent sprite after it has completed it's animation
// The event.data.array is where the sprite needs to be cleaned from
const cleanupIndependentSprite = (event) => {
  let array = event.data.array;
  let $sprite = $(event.currentTarget);
  // Remove the one-time listener
  $sprite.off('oanimationend animationend webkitAnimationEnd', cleanupIndependentSprite);
  // Clean up the sprite
  cleanObjectFormArrayAndDOM($sprite, array);
}

// Clean up the sprite's state and then move it again
const moveEnemyCallback = (event) => {
  let $enemy = $(event.currentTarget);
  // Remove the current listener
  $enemy.off('oanimationend animationend webkitAnimationEnd', moveEnemyCallback);
  // Affix the player to its new location
  affixPositionToParent($enemy, stateData.$enemySpace);
  // Clear off the movement style
  $enemy.removeClass(enemyOps.style.join(' '));
  // Move the enemy again (sometime between immediately and .5 seconds later)
  setTimeout(moveEnemy, (Math.floor(Math.random()*500)+50), $enemy);
}
