const circleRadius = 3;

function drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
  ctx.fill();
}

function drawPath(ctx: CanvasRenderingContext2D, points: number[][]) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
}

function drawFinger(ctx: CanvasRenderingContext2D, keypoints: number[][]) {
  let pathPoints = [];
  for (let i = 0; i < keypoints.length; i++) {
    drawPoint(ctx, keypoints[i][0], keypoints[i][1]);
    pathPoints.push(keypoints[i]);
  }
  drawPath(ctx, pathPoints);
}

export const drawHand = (ctx: CanvasRenderingContext2D, keypoints: number[][]) => {
  ctx.strokeStyle = 'red';
  ctx.fillStyle = 'red';

  // draw palm 
  drawPath(ctx, [keypoints[0], keypoints[5], keypoints[9], keypoints[13], keypoints[17], keypoints[0]]);
  // thumb
  drawFinger(ctx, keypoints.slice(0, 5));
  // index
  drawFinger(ctx, keypoints.slice(5, 9));
  // middle
  drawFinger(ctx, keypoints.slice(9, 13));
  // ring
  drawFinger(ctx, keypoints.slice(13, 17));
  // pinky
  drawFinger(ctx, keypoints.slice(17, 21));
};
