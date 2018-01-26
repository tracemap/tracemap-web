import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { MainComponent } from './main.component';
import { UserComponent } from './user.component';
import { InfoComponent } from './info.component';
import { D3Component } from './d3.component';
import { SearchComponent } from './search.component';
import { PageNotFoundComponent } from './page-not-found.component';

import { HomePageComponent } from './home-page/home-page.component';
import { DescriptionVkComponent } from './home-page/description-vk.component';
import { DescriptionTwitterComponent } from './home-page/description-twitter.component';

import { ApiService } from './api.service';
import { MainCommunicationService } from './main.communication.service';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    UserComponent,
    InfoComponent,
    D3Component,
    SearchComponent,
    PageNotFoundComponent,
    HomePageComponent,
      DescriptionVkComponent,
      DescriptionTwitterComponent,
  ],
  imports: [
    BrowserModule,
    HttpModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [ 
    ApiService,
    MainCommunicationService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
