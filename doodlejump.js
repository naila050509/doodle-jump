// CONFIG / LOGICAL BOARD SIZE (do not change unless you adapt physics)
const boardWidth = 360;
const boardHeight = 576;

// board + context
let board;
let context;

// doodler
let doodlerWidth = 46;
let doodlerHeight = 46;
let doodlerX = boardWidth / 2 - doodlerWidth / 2;
let doodlerY = (boardHeight * 7) / 8 - doodlerHeight;
let doodlerRightImg = null;
let doodlerLeftImg = null;
let doodler = {
  img: null,
  x: doodlerX,
  y: doodlerY,
  width: doodlerWidth,
  height: doodlerHeight,
};

// physics
let velocityX = 0;
let velocityY = 0;
let initialVelocityY = -8; // jump initial velocity
let gravity = 0.4;

// platforms
let platformArray = [];
let platformWidth = 60;
let platformHeight = 18;
let platformImg = null;

// scoring & state
let score = 0;
let maxScore = 0;
let gameOver = false;

// UI elements (filled on load)
let leftBtn, rightBtn, scoreEl, restartBtn, controlsWrap;

//
// Resize helper: sets canvas CSS size to scale down to fit screen,
// while canvas internal resolution remains boardWidth x boardHeight.
// That keeps physics/drawing stable and crisp.
function resizeGame() {
  // compute scale that fits within viewport but does not upscale above 1
  const margin = 16; // small margin
  const maxWidth = window.innerWidth - margin * 2;
  const maxHeight = window.innerHeight - 120; // leave room for HUD/controls
  const scale = Math.min(maxWidth / boardWidth, maxHeight / boardHeight, 1);

  board.style.width = Math.round(boardWidth * scale) + "px";
  board.style.height = Math.round(boardHeight * scale) + "px";
}

window.onload = function () {
  board = document.getElementById("board");
  // set internal canvas resolution
  board.width = boardWidth;
  board.height = boardHeight;
  context = board.getContext("2d");

  // UI refs
  leftBtn = document.getElementById("leftBtn");
  rightBtn = document.getElementById("rightBtn");
  scoreEl = document.getElementById("score");
  restartBtn = document.getElementById("restartBtn");
  controlsWrap = document.getElementById("controls");

  // load images
  doodlerRightImg = new Image();
  doodlerRightImg.src = "./doodler-right.png";
  doodlerLeftImg = new Image();
  doodlerLeftImg.src = "./doodler-left.png";
  platformImg = new Image();
  platformImg.src = "./platform.png";

  // set starting doodler image (if image not loaded yet it's okay)
  doodler.img = doodlerRightImg;

  // initial physics
  velocityY = initialVelocityY;

  // initial layout + listeners
  resizeGame();
  window.onresize = resizeGame;

  placePlatforms();
  requestAnimationFrame(update);

  // keyboard
  document.addEventListener("keydown", moveDoodler);
  document.addEventListener("keyup", stopDoodler);

  // mobile buttons (if exist)
  if (leftBtn && rightBtn) {
    // prevent default to avoid scrolling
    leftBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      velocityX = -4;
      doodler.img = doodlerLeftImg;
    }, {passive: false});
    leftBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      velocityX = 0;
    });

    rightBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      velocityX = 4;
      doodler.img = doodlerRightImg;
    }, {passive: false});
    rightBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      velocityX = 0;
    });
  }

  // swipe support: move while touch drag left/right
  let startX = null;
  document.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length === 0) return;
    startX = e.touches[0].clientX;
  }, {passive: true});

  document.addEventListener("touchmove", (e) => {
    if (!startX || !e.touches || e.touches.length === 0) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    if (diff > 25) {
      velocityX = 4;
      doodler.img = doodlerRightImg;
    } else if (diff < -25) {
      velocityX = -4;
      doodler.img = doodlerLeftImg;
    }
  }, {passive: true});

  document.addEventListener("touchend", () => {
    startX = null;
    velocityX = 0;
  });

  // restart button
  if (restartBtn) {
    restartBtn.addEventListener("click", restartGame);
  }

  // hide mobile controls if screen is big
  toggleMobileControls();
  window.addEventListener("resize", toggleMobileControls);
};

function toggleMobileControls() {
  if (!controlsWrap) return;
  if (window.innerWidth <= 600) {
    controlsWrap.setAttribute("aria-hidden", "false");
    controlsWrap.style.display = "flex";
  } else {
    controlsWrap.setAttribute("aria-hidden", "true");
    controlsWrap.style.display = "none";
  }
}

function update() {
  requestAnimationFrame(update);
  if (gameOver) return;

  // clear using logical resolution
  context.clearRect(0, 0, board.width, board.height);

  // doodler horizontal movement + wrap
  doodler.x += velocityX;
  if (doodler.x > boardWidth) doodler.x = 0;
  else if (doodler.x + doodler.width < 0) doodler.x = boardWidth;

  // vertical physics
  velocityY += gravity;
  doodler.y += velocityY;

  // fall below bottom -> game over
  if (doodler.y > board.height) {
    gameOver = true;
    showGameOver();
  }

  // draw doodler
  if (doodler.img && doodler.img.complete) {
    context.drawImage(doodler.img, doodler.x, doodler.y, doodler.width, doodler.height);
  } else {
    // fallback rectangle while image loads
    context.fillStyle = "green";
    context.fillRect(doodler.x, doodler.y, doodler.width, doodler.height);
  }

  // platforms logic & draw
  for (let i = 0; i < platformArray.length; i++) {
    let platform = platformArray[i];

    // if doodler going up and is above threshold, move platforms downward (simulate camera)
    if (velocityY < 0 && doodler.y < (boardHeight * 3) / 4) {
      // initialVelocityY is negative so subtracting it moves platforms down
      platform.y -= initialVelocityY;
    }

    // detect collision only when doodler falling or nearly stopped (velocityY >= 0)
    if (detectCollision(doodler, platform) && velocityY >= 0) {
      // ensure doodler lands on top of platform (simple fix)
      if (doodler.y + doodler.height <= platform.y + platform.height) {
        velocityY = initialVelocityY;
      }
    }

    // draw platform
    if (platform.img && platform.img.complete) {
      context.drawImage(platform.img, platform.x, platform.y, platform.width, platform.height);
    } else {
      context.fillStyle = "#6b8e23";
      context.fillRect(platform.x, platform.y, platform.width, platform.height);
    }
  }

  // remove platforms off bottom and spawn new ones at top
  while (platformArray.length > 0 && platformArray[0].y >= boardHeight) {
    platformArray.shift();
    newPlatform();
  }

  // update score display
  updateScore();
  if (scoreEl) scoreEl.innerText = score;
}

function moveDoodler(e) {
  // keyboard controls
  if (e.code === "ArrowRight" || e.code === "KeyD") {
    velocityX = 4;
    doodler.img = doodlerRightImg;
  } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
    velocityX = -4;
    doodler.img = doodlerLeftImg;
  } else if (e.code === "Space" && gameOver) {
    restartGame();
  }
}

function stopDoodler(e) {
  // stop horizontal movement when key released
  if (e.code === "ArrowRight" || e.code === "KeyD") {
    velocityX = 0;
  } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
    velocityX = 0;
  }
}

function placePlatforms() {
  platformArray = [];

  // base platform in the bottom center
  platformArray.push({
    img: platformImg,
    x: boardWidth / 2 - platformWidth / 2,
    y: boardHeight - 50,
    width: platformWidth,
    height: platformHeight,
  });

  // random platforms above
  for (let i = 0; i < 6; i++) {
    let randomX = Math.floor(Math.random() * (boardWidth - platformWidth));
    platformArray.push({
      img: platformImg,
      x: randomX,
      y: boardHeight - 75 * i - 150,
      width: platformWidth,
      height: platformHeight,
    });
  }

  // reset doodler position
  doodler.x = doodlerX;
  doodler.y = doodlerY;
}

function newPlatform() {
  let randomX = Math.floor(Math.random() * (boardWidth - platformWidth));
  platformArray.push({
    img: platformImg,
    x: randomX,
    y: -platformHeight,
    width: platformWidth,
    height: platformHeight,
  });
}

function detectCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function updateScore() {
  // increment while rising, reduce while falling to simulate "peak"
  let points = Math.floor(50 * Math.random());
  if (velocityY < 0) {
    maxScore += points;
    if (score < maxScore) score = maxScore;
  } else {
    maxScore -= Math.floor(points / 3);
    if (maxScore < 0) maxScore = 0;
    if (score < 0) score = 0;
    if (score > maxScore) score = maxScore;
  }
}

// show Game Over UI
function showGameOver() {
  const restartBtnEl = document.getElementById("restartBtn");
  if (restartBtnEl) {
    restartBtnEl.classList.remove("hidden");
  }
  // draw Game Over text on canvas
  context.fillStyle = "rgba(0,0,0,0.6)";
  context.fillRect(0, boardHeight * 0.72, boardWidth, boardHeight * 0.28);
  context.fillStyle = "#fff";
  context.font = "18px sans-serif";
  context.fillText("Game Over", boardWidth / 2 - 40, boardHeight * 0.78);
  context.font = "14px sans-serif";
  context.fillText("Press Space or Restart button", boardWidth / 8, boardHeight * 0.83);
}

function restartGame() {
  // reset state
  doodler = {
    img: doodlerRightImg,
    x: doodlerX,
    y: doodlerY,
    width: doodlerWidth,
    height: doodlerHeight,
  };
  velocityX = 0;
  velocityY = initialVelocityY;
  score = 0;
  maxScore = 0;
  gameOver = false;

  placePlatforms();

  // hide restart button
  if (restartBtn) restartBtn.classList.add("hidden");
}
