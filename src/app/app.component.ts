import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import { drawHand } from './hand-renderer';
import { gestureList, GestureResult } from './fingerpose-handler';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { LoadingComponent } from './loading/loading.component';

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
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent, MatButtonModule, MatDividerModule, LoadingComponent],
  animations: [
    trigger('pulse', [
      transition('* => void', []),
      transition('* => *', [
        animate('1s', keyframes([
          style({ opacity: 0, fontSize: '1em'}),
          style({ opacity: 1, fontSize: '5em'}),
          style({ opacity: 1, fontSize: '5em'}),
          style({ opacity: 0, fontSize: '4em'}),
        ]))
      ])
    ])
  ],
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
  loadingStatus = "connecting to webcam..."
  latestPosition: number[][] | undefined;
  countdown = 5;
  isCountingDown = false;
  playerSign: GestureResult | undefined;
  computerSign: string | undefined;
  playerScore = 0;
  computerScore = 0;
  gameResult = "";

  playerLosingStreak = 0;
  pastPlayerMoves: GestureResult[] = [];
  markovChain: { [k: string]: any } = {};
  anticipation: { [k: string]: number } = {
    'Rock': 0,
    'Paper': 0,
    'Scissors': 0
  }

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
          if (this.computerStrategy == ComputerStrategies.Anticipate) {
            let currentGesture = this.lookForGesture(predictions[0].landmarks);
            if (currentGesture) {
              this.anticipation[currentGesture.name] = this.anticipation[currentGesture.name] + 1;
            }
          }
          this.latestPosition = predictions[0].landmarks; // ANTICIPATE
          if (!this.isCountingDown && !this.freezeVideo) {
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
    this.countdown--;
    if (this.countdown > 0) {
      setTimeout(() => this.incrementCountdown(), 1000);
    } else {
      this.isCountingDown = false;
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

  lookForGesture(landmarks: number[][]): GestureResult {
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
    this.pastPlayerMoves.push(this.playerSign);
    if (this.playerSign.name == this.computerSign) {
      this.gameResult = "It's a tie!";
    } else if (
      this.playerSign.name == Signs[1] && this.computerSign == Signs[3]
      || this.playerSign.name == Signs[2] && this.computerSign == Signs[1]
      || this.playerSign.name == Signs[3] && this.computerSign == Signs[2]
    ) {
      this.gameResult = "Well done, you win!";
      this.playerScore++;
      this.playerLosingStreak = 0;
    } else {
      this.gameResult = "Aww, you lose!";
      this.computerScore++;
      this.playerLosingStreak++;
    }
  }

  getRandomSign(): string {
    return Signs[Math.floor(Math.random() * 3) + 1];
  }

  getWinningSign(signToBeat: string): string {
    switch (signToBeat) {
      case (Signs[1]): {
        return Signs[2];
      }
      case (Signs[2]): {
        return Signs[3];
      }
      default: {
        return Signs[1];
      }
    }
  }

  getComputerSign() {
    switch (this.computerStrategy) {
      case (ComputerStrategies.Random): {
        return this.getRandomSign();
      };
      case (ComputerStrategies.Conditional): {
        // This strategy is called "win-stay, lose-shift"
        // If a player wins once, it's likely that they'll repeat the same action as before
        if (this.playerLosingStreak == 0 && this.pastPlayerMoves.length > 0) {
          return this.getWinningSign(this.pastPlayerMoves[this.pastPlayerMoves.length - 1].name);
        }
        // If a player has lost two or more times, they're most likely to shift to the play that would have beaten what they just lost to
        else if (this.playerLosingStreak > 1 && this.pastPlayerMoves.length > 0) {
          return this.pastPlayerMoves[this.pastPlayerMoves.length - 1].name;
        } else {
          return this.getRandomSign();
        }
      };
      case (ComputerStrategies.Markov): {
        // Add to markov chain from previous moves
        let lastPlayed = this.pastPlayerMoves.length ? this.pastPlayerMoves[this.pastPlayerMoves.length - 1].name : undefined;
        let nextLikely;

        if (this.pastPlayerMoves.length >= 2 && lastPlayed) {
          let pastMove = this.pastPlayerMoves[this.pastPlayerMoves.length - 2].name;
          if (!this.markovChain[pastMove]) {
            this.markovChain[pastMove] = {};
          }
          if (!this.markovChain[pastMove][lastPlayed]) {
            this.markovChain[pastMove][lastPlayed] = { occurances: 1 };
          } else {
            this.markovChain[pastMove][lastPlayed].occurances = this.markovChain[pastMove][lastPlayed].occurances + 1;
          }
        }
        if (this.pastPlayerMoves.length > 1 && lastPlayed && this.markovChain[lastPlayed]) {
          for (let key in this.markovChain[lastPlayed]) {
            if (!nextLikely) {
              nextLikely = key;
            } else {
              if (this.markovChain[lastPlayed][key].occurances > this.markovChain[lastPlayed][nextLikely].occurances) {
                nextLikely = key;
              }
            }
          }
        }
        if (!nextLikely) {
          // Couldn't predict from the chain, pick randomly
          return this.getRandomSign();
        } else {
          return this.getWinningSign(nextLikely);
        }
      };
      case (ComputerStrategies.Anticipate): {
        let mostAnticipated = Signs[1];
        if (this.anticipation[Signs[2]] > this.anticipation[Signs[1]] && this.anticipation[Signs[2]] > this.anticipation[Signs[3]]) {
          mostAnticipated = Signs[2];
        } else if (this.anticipation[Signs[3]] > this.anticipation[Signs[1]] && this.anticipation[Signs[3]] > this.anticipation[Signs[2]]) {
          mostAnticipated = Signs[3];
        }
        return this.getWinningSign(mostAnticipated);
      }
      default: {
        return this.getRandomSign();
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
    this.anticipation = {
      'Rock': 0,
      'Paper': 0,
      'Scissors': 0
    }
  }

  reset() {
    this.resetVariables();
    this.drawVideoOnCanvas();
  }

  changeStrategy() {
    this.computerStrategy = undefined;
    this.loadingStatus = "connecting to webcam..."
    this.isLoadingCamera = true;
    this.resetVariables();
    this.playerScore = 0;
    this.computerScore = 0;
    this.playerLosingStreak = 0;
    this.pastPlayerMoves = [];
    this.markovChain = {};
  }
}
