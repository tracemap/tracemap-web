import { Component, Input, Output, OnChanges, EventEmitter } from '@angular/core';
import { ApiService } from './../../services/api.service';

@Component({
    selector: 'tweet-card',
    templateUrl: './tweet-card.component.html',
    styleUrls: ['./tweet-card.component.scss']
})

export class TweetCardComponent implements OnChanges {
    @Input('tweetId')
    tweetId: string;
    @Output()
    rendered = new EventEmitter();

    retweetCount: number;

    constructor(
        private apiService: ApiService
    ){}

    ngOnChanges() {
        if( this.tweetId) {
            this.apiService.getTweetInfo(this.tweetId).subscribe( tweetInfo => {
                this.retweetCount = tweetInfo[this.tweetId]["retweet_count"];
            })
        }
    }

    tweetRendered( tweetId: string) {
        this.rendered.next(tweetId);
    }

}