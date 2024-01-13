import { Component, ElementRef, ViewChild, signal } from '@angular/core';
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
          style({ opacity: 0, fontSize: '1em' }),
          style({ opacity: 1, fontSize: '5em' }),
          style({ opacity: 1, fontSize: '5em' }),
          style({ opacity: 0, fontSize: '4em' }),
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

  protected computerStrategy: ComputerStrategies | undefined;
  protected stream: MediaStream | undefined;
  protected freezeVideo = false;
  protected model: handpose.HandPose | undefined;
  protected isLoadingCamera = true;
  protected loadingStatus = "connecting to webcam..."
  protected countdown = 5;
  protected isCountingDown = false;
  protected playerSign: GestureResult | undefined;
  protected computerSign: string | undefined;
  protected readonly playerScore = signal(0);
  protected readonly computerScore = signal(0);
  protected gameResult = "";
  protected readonly isMuted = signal(false);
  protected lookingForHand = false;

  private latestPosition: number[][] | undefined;
  private playerLosingStreak = 0;
  private pastPlayerMoves: GestureResult[] = [];
  private markovChain: { [k: string]: any } = {};
  private anticipation: { [k: string]: number } = {
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
          this.lookingForHand = false;
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
        this.lookingForHand = true;
        this.model = model;
        this.drawVideoOnCanvas();
      })
      .catch((err) => {
        alert('No video source found. Try restarting your browser and checking your web cam is connected properly!');
        this.computerStrategy = undefined;
        console.error(err);
      });
  }

  incrementCountdown() {
    this.countdown--;
    if (this.countdown > 0) {
      this.playAudio("countdown");
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
    this.playAudio("countdown");
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
      this.playAudio("tie");
    } else if (
      this.playerSign.name == Signs[1] && this.computerSign == Signs[3]
      || this.playerSign.name == Signs[2] && this.computerSign == Signs[1]
      || this.playerSign.name == Signs[3] && this.computerSign == Signs[2]
    ) {
      this.gameResult = "Well done, you win!";
      this.playAudio("win");
      this.playerScore.set(this.playerScore() + 1);
      this.playerLosingStreak = 0;
    } else {
      this.gameResult = "Aww, you lose!";
      this.playAudio("lose");
      this.computerScore.set(this.computerScore() + 1);
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

  toggleAudio() {
    this.isMuted.set(!this.isMuted());
  }

  playAudio(path: string){
    if (this.isMuted()) {
      return;
    }
    let audio = new Audio();
    audio.src = "assets/" + path + ".mp3";
    audio.load();
    audio.play();
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
    this.playerScore.set(0);
    this.computerScore.set(0);
    this.playerLosingStreak = 0;
    this.pastPlayerMoves = [];
    this.markovChain = {};
  }
}
