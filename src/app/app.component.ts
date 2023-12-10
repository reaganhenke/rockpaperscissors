import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import { drawHand } from './hand-renderer';
import { gestureList, GestureResult } from './fingerpose-handler';

enum ComputerStrategies {
  Random = 1,
  Conditional,
  Markov,
  Anticipate
}
enum Signs {
  Rock = 1,
  Paper,
  Scissors
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  @ViewChild('canvas') canvas: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild('video') video: ElementRef<HTMLVideoElement> | undefined;

  computerStrategy: ComputerStrategies | undefined;
  stream: MediaStream | undefined;
  freezeVideo = false;
  model: handpose.HandPose | undefined;
  isLoadingCamera = true;
  loadingStatus = "booting up webcam..."
  latestPosition: number[][] | undefined;
  countdown = 5;
  isCountingDown = false;
  playerSign: GestureResult | undefined;
  computerSign: string | undefined;
  playerScore = 0;
  computerScore = 0;
  gameResult = "";

  selectStrat(strat: number) {
    this.computerStrategy = strat;
    this.loadWebCam();
  }

  drawVideoOnCanvas() {
    const videoContext = this.video?.nativeElement as HTMLVideoElement;
    const canvasElem = this.canvas?.nativeElement as HTMLCanvasElement;
    const context = canvasElem.getContext('2d') as CanvasRenderingContext2D;

    const streamWidth = this.stream?.getVideoTracks()[0].getSettings().width as number;
    const streamHeight = this.stream?.getVideoTracks()[0].getSettings().height as number;

    // Need to resize width, height is 400, width is 500, and video size is set to cover
    const clippedWidth = streamWidth - ((streamHeight * 500) / 400);

    context.canvas.height = streamHeight;
    context.canvas.width = streamWidth - clippedWidth;

    context.clearRect(0, 0, videoContext.width, videoContext.height);
    // shift over and flip so image appears mirrored
    context.translate(canvasElem.width, 0);
    context.scale(-1, 1);

    const runDetection = () => {
      this.model?.estimateHands(videoContext).then((predictions) => {
        this.isLoadingCamera = false;
        context.drawImage(
          videoContext,
          clippedWidth / 2,
          0,
          streamWidth - clippedWidth,
          streamHeight,
          0,
          0,
          streamWidth - clippedWidth,
          streamHeight
        );

        if (predictions && predictions[0]) {
          let translatedLandmarks = predictions[0].landmarks.map(point => [point[0] - (clippedWidth / 2), point[1], point[2]]);
          drawHand(context, translatedLandmarks);
          this.latestPosition = predictions[0].landmarks;
          if (!this.isCountingDown) {
            this.startCountdown();
          }
        }
        if (!this.freezeVideo) {
          requestAnimationFrame(runDetection);
        }
      });
    };
    runDetection();
  }

  loadWebCam() {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        this.stream = stream;
        this.loadingStatus = "loading tensorflow handpose model..."
        return handpose.load();
      })
      .then((model) => {
        this.loadingStatus = "processing image and looking for hands..."
        this.model = model;
        this.drawVideoOnCanvas();
      })
      .catch((err) => {
        console.error(err);
      });
  }

  incrementCountdown() {
    if (this.countdown > 0) {
      this.countdown--;
      setTimeout(() => this.incrementCountdown(), 1000);
    } else {
      this.freezeVideo = true;
      if (this.latestPosition) {
        this.playerSign = this.lookForGesture(this.latestPosition);
      }
      this.computerSign = this.getComputerSign();
      this.getResult();
    }
  }

  startCountdown() {
    this.isCountingDown = true;
    this.countdown = 5;
    setTimeout(() => {
      this.incrementCountdown();
    }, 1000)
  }

  lookForGesture(landmarks: number[][]) {
    const { gestures } = gestureList.estimate(landmarks, 7.5);
    return gestures ? gestures[0] : undefined;
  }

  playerResult() {
    if (this.playerSign) {
      return `You played ${this.playerSign.name} (${this.playerSign.score * 10}% confidence)`
    } else {
      return `No hand pose was detected.`;
    }
  }

  getResult() {
    if (!this.playerSign) {
      this.gameResult = "Couldn't find a hand... Try again?"
      return;
    }
    if (this.playerSign.name == this.computerSign) {
      this.gameResult = "Tie";
    } else if (
      this.playerSign.name == Signs[1] && this.computerSign == Signs[3]
      || this.playerSign.name == Signs[2] && this.computerSign == Signs[1]
      || this.playerSign.name == Signs[3] && this.computerSign == Signs[2]
    ) {
      this.gameResult = "You win!";
      this.playerScore++;
    } else {
      this.gameResult = "You lose!";
      this.computerScore++;
    }
  }

  getComputerSign() {
    switch (this.computerStrategy) {
      case (ComputerStrategies.Random): {
        return Signs[Math.floor(Math.random() * 3) + 1];
      };
      default: {
        console.log("hasn't been implemented yet");
        return Signs[1];
      }
    }
  }

  resetVariables() {
    this.freezeVideo = false;
    this.countdown = 5;
    this.isCountingDown = false;
    this.gameResult = "";
    this.playerSign = undefined;
    this.computerSign = undefined;
  }

  reset() {
    this.resetVariables();
    this.drawVideoOnCanvas();
  }

  changeStrategy() {
    this.computerStrategy = undefined;
    this.loadingStatus = "booting up webcam..."
    this.isLoadingCamera = true;
    this.resetVariables();
    this.playerScore = 0;
    this.computerScore = 0;
  }
}
