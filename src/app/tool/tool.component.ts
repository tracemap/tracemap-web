import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { ApiService } from './../services/api.service';
import { GraphService } from './services/graph.service';

@Component({
    selector: 'tool',
    templateUrl: './tool.component.html',
    styleUrls: ['./tool.component.scss']
})

export class ToolComponent implements OnInit {

    tweetId: string;
    tracemapData: object;
    graphData: object;
    newMode = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private apiService: ApiService,
        private graphService: GraphService
    ) {}

    createSubDict(sourceDict: object, keys: string[]): Promise<object> {
        return new Promise( (resolve, reject) => {
            let subDict = {};
            keys.map( key => {
                subDict[key] = sourceDict[key];
            });
            resolve( subDict);
        });
    }

    ngOnInit(): void {
        this.route.params.subscribe( params => {
            this.tweetId = params["tid"];  

            this.apiService.getTracemapData( this.tweetId)
                .then( tracemapData => {
                    let authorKeys = [
                        'id_str',
                        'favourites_count',
                        'followers_count',
                        'friends_count'
                    ];

                    this.tracemapData = tracemapData;
                    let authorInfo = this.tracemapData['tweet_data']['tweet_info']['user'];
                    return this.createSubDict(authorInfo, authorKeys);
                }).then( graphAuthorInfo => {
                    this.graphData = {};
                    this.graphData['author_info'] = graphAuthorInfo;
                    this.graphData['author_info']['group'] = 0;
                    this.graphData['author_info']['retweet_created_at'] = this.tracemapData['tweet_data']['tweet_info']['created_at'];
                    let retweetersInfo = this.tracemapData['tweet_data']['retweet_info']
                    this.graphData['retweet_info'] = {};
                    let promiseArray:Array<any> = [];
                    this.tracemapData['tweet_data']['retweeter_ids'].forEach( retweeterId => {
                        let retweeterInfo = retweetersInfo[retweeterId]['user'];
                        let tmp = {};
                        tmp['favourites_count'] = retweeterInfo['favourites_count'];
                        tmp['followers_count'] = retweeterInfo['followers_count'];
                        tmp['friends_count'] = retweeterInfo['friends_count'];
                        tmp['retweet_created_at'] = retweetersInfo[retweeterId]['created_at'];
                        this.graphData['retweet_info'][retweeterId] = tmp;
                    });
                    this.addGraphData();
                })
        })
    }

    addGraphData(): void {
        let graphElements = {
            "nodes": [],
            "links": []
        }

        // Necessary because the twitter api sometimes returns users multiple times
        let nodesChecked = [];
        this.tracemapData['tweet_data']['retweeter_ids'].forEach( retweeter => {
            if( nodesChecked.indexOf(retweeter) < 0) {
                nodesChecked.push(retweeter);
                let node = this.graphData['retweet_info'][retweeter];
                node['id_str'] = retweeter;
                node['group'] = 1
                graphElements['nodes'].push(node);
            }
        });

        let authorId = this.graphData['author_info']['id_str'];
        let followers = this.tracemapData['followers'];

        let retweeterIds = this.tracemapData['tweet_data']['retweeter_ids'];
        this.apiService.labelUnknownUsers( retweeterIds, authorId).subscribe( (answer) => {
            console.log("Unknown users are crawled live."); //TODO: return number of unknown users
        })

        if(authorId in followers && this.newMode) {
            // New mechanic if author is in our database
            let connectedUsers = [];
            let checkedUsers = [];

            followers[authorId].forEach( targetId => {
                connectedUsers.push(targetId);
                checkedUsers.push(targetId);
                graphElements['links'].push({
                    'source':authorId,
                    'target':targetId
                });
            });

            let oldLinkNum = graphElements['links'].length;
            let newLinkNum = oldLinkNum + 1;

            while( oldLinkNum !== newLinkNum) {
                let tmpConnectedUsers = [];
                oldLinkNum = newLinkNum;
                connectedUsers.forEach( sourceId => {
                    if( sourceId in followers) {
                        followers[sourceId].forEach( targetId => {
                            if( targetId !== authorId) {
                                if( this.targetTweetNewer(sourceId, targetId)) {
                                    if( checkedUsers.indexOf(targetId) < 0){
                                        tmpConnectedUsers.push(targetId);
                                        checkedUsers.push(targetId);
                                    }
                                    graphElements['links'].push({
                                        'source': sourceId,
                                        'target': targetId,
                                    });
                                }
                            }
                        });
                    }
                });
                connectedUsers = tmpConnectedUsers;
                newLinkNum = graphElements['links'].length;
            }
            graphElements['nodes'].push(this.graphData['author_info']);
        } else {
            // Old mechanic for tweets where the author isnt in our database
            if(authorId in followers){
                console.log("THE APP IS RUNNING WITH OLD GRAPH LOGIC");
                followers[authorId].forEach( targetId => {
                    graphElements['links'].push({
                        'source':authorId,
                        'target':targetId
                    });
                });
            } else {
                this.graphData['auther_unknown'] = true;
                console.log("THE AUTHOR OF THE TWEET IS NOT IN OUR DATABASE");
            }

            graphElements['nodes'].push(this.graphData['author_info']);
            graphElements['nodes'].forEach( source => {
                let sourceId = source['id_str'];
                if( sourceId in followers) {
                    followers[sourceId].forEach( targetId => {
                        if( !(targetId === authorId || sourceId === authorId)) {
                            if( this.targetTweetNewer(sourceId, targetId)) {
                                graphElements['links'].push({
                                    'source': sourceId,
                                    'target': targetId
                                });
                            }
                        }
                    });
                }
            });
        }
        let linkSources = graphElements['links'].map( link => {
            return link['source'];
        });
        let linkTargets = graphElements['links'].map( link => {
            return link['target'];
        });
        this.graphData['nodes'] = [];
        // just return nodes with connected links
        graphElements['nodes'].forEach( (node) => {
            if( linkSources.indexOf(node['id_str']) >= 0 ||
                linkTargets.indexOf(node['id_str']) >= 0) {
                this.graphData['nodes'].push(node);
            }
        });
        this.graphData['links'] = graphElements['links'];

        this.graphService.graphData.next(this.graphData);
    }
    targetTweetNewer( sourceId: string, targetId: string): boolean {
        let sourceTimestamp = Date.parse(this.graphData['retweet_info']
                                       [sourceId]
                                       ['retweet_created_at']);
        let targetTimestamp = Date.parse(this.graphData['retweet_info']
                                       [targetId]
                                       ['retweet_created_at']);
        if( sourceTimestamp < targetTimestamp) {
            return true;
        } else {
            return false;
        }
    }
}