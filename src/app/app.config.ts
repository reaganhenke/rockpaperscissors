import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAnalytics, provideAnalytics, ScreenTrackingService } from '@angular/fire/analytics';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideAnimations(), importProvidersFrom(provideFirebaseApp(() => initializeApp({"projectId":"tensorflowrockpaperscissors","appId":"1:189482817061:web:06ff0c1d8573d40aa491cc","storageBucket":"tensorflowrockpaperscissors.appspot.com","apiKey":"AIzaSyCT4WEPatxtF55tL20C6bf4KmyfJcLOkgI","authDomain":"tensorflowrockpaperscissors.firebaseapp.com","messagingSenderId":"189482817061","measurementId":"G-JVLWVLM931"}))), importProvidersFrom(provideAnalytics(() => getAnalytics())), ScreenTrackingService]
};
