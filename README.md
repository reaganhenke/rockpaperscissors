# Rock, Paper, Scissors (with Tensorflow JS)

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.0.5 and uses [tensorflow.js](https://www.tensorflow.org/js), a library for machine learning in Javascript. Video from the webcam is passed to a pre-trained image recognition model that detects a hand and returns 21 landmark keypoints indicating its position. We then use [fingerpose](https://www.npmjs.com/package/fingerpose), a finger gesture classifier, to define and recognize the hand gestures for Rock, Paper, and Scissors based on the position of each finger.

The computer can then play Rock, Paper, Scissors with varying levels of "intelligence". From randomly selecting a sign, to trying to anticipate the player's next move, there's a variety of methods that often feel like artificial intelligence. 

This project is not yet deployed.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Found a Bug?

If you find a bug in the source code, you can help by submitting an issue, or even better, you can submit a Pull Request with a fix! If you have an idea for a new feature, feel free to open an issue for that as well!
