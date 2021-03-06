import { Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { environment } from '../../environments/environment';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/observable/forkJoin';
import { UserService } from './user.service';

@Injectable( )

export class ApiService {
    url = environment.apiUrl;
    email: string;
    sessionToken: string;


    tracemapData = new BehaviorSubject<object>(undefined);
    graphData = new BehaviorSubject<object>(undefined);

    jsonHeader = new Headers({
        'Content-Type': 'application/json'
    });

    constructor(
        private http: Http,
        private userService: UserService
    ) {
        this.userService.credentials.subscribe( credentials => {
            if (credentials) {
                this.email = credentials['email'].toLowerCase();
                this.sessionToken = credentials['session_token'];
            }
        });
    }

    // Tool Methods

    getTweetInfo( tweetId: string): Observable<object> {
        console.log('#apiService#: getTweetInfo');
        const url = this.url + '/twitter/get_tweet_info';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            tweet_id: tweetId
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => {
                const data = response.json();
                return data['response'];
            });
    }

    getTweetData( tweetId: string): Observable<object> {
        console.log('#apiService#: getTweetData');
        const url = this.url + '/twitter/get_tweet_data';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            tweet_id: tweetId
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => {
                const data = response.json();
                return data['response'];
            });
    }

    getTimeline( userId: string): Observable<object> {
        console.log('#apiService#: getTimeline');
        const url = this.url + '/twitter/get_user_timeline';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            user_id: userId
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    getUserInfo( userId: string): Observable<object> {
        console.log('#apiService#: getUserInfo');
        const url = this.url + '/twitter/get_user_info';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            user_id: userId
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    getFollowers( retweeterIds: string[], authorId: string): Observable<object> {
        console.log('#apiService#: getFollowers');
        const userIds = retweeterIds.concat([authorId]);
        const url = this.url + '/neo4j/get_followers';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            user_ids: userIds
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    getTracemapData(tweetId: string): Promise<object> {
        console.log('#apiService#: getTracemapData');
        const tracemapData = {};
        return new Promise( (resolve, reject) => {
            this.getTweetData( tweetId)
                .flatMap( tweetData => {
                    tracemapData['tweet_data'] = tweetData;
                    const userIds = tracemapData['tweet_data']['retweeter_ids'];
                    const authorId = tracemapData['tweet_data']['tweet_info']['user']['id_str'];
                    return this.getFollowers( userIds, authorId);
                }).subscribe( followersList => {
                    tracemapData['followers'] = followersList;
                    this.tracemapData.next(tracemapData);
                    resolve( tracemapData);
            });
        });
    }

    labelUnknownUsers( retweeterIds: string[]): Observable<string[]> {
        console.log('#apiService#: labelUnknownUsers');
        const url = this.url + '/neo4j/label_unknown_users';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            user_ids: retweeterIds
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    // Nontool Methods

    newsletterStartSubscription( email: string, subscriptions: object): Observable<string> {
        console.log('#apiService#: addToNewsletter()');
        const url = this.url + '/newsletter/start_subscription';
        const body = JSON.stringify({
            email: email.toLowerCase(),
            beta_subscribed: subscriptions['beta_queue'],
            newsletter_subscribed: subscriptions['newsletter']
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    authAddUser( username: string, email: string): Observable<object> {
        console.log('#apiService#: authAddUser');
        const url = this.url + '/auth/add_user';
        const body = JSON.stringify({
            username: username,
            email: email.toLowerCase()
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    authCheckPassword( email: string, password: string): Observable<string> {
        console.log('#apiService#: authCheckPassword()');
        const url = this.url + '/auth/check_password';
        const body = JSON.stringify({
            email: email.toLowerCase(),
            password: password
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json() );
    }

    authCheckSession( email: string, sessionToken: string): Observable<string> {
        console.log('#apiService#: authCheckSession()');
        const url = this.url + '/auth/check_session';
        const body = JSON.stringify({
            email: email.toLowerCase(),
            session_token: sessionToken
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json() );
    }

    authGetUsername( email: string, sessionToken: string): Observable<string> {
        console.log('#apiService#: authGetUserData()');
        const url = this.url + '/auth/get_username';
        const body = JSON.stringify({
            email: email.toLowerCase(),
            session_token: sessionToken
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    authChangePassword( oldPassword: string, newPassword: string): Observable<object> {
        console.log('#apiService#: authChangePassword()');
        const url = this.url + '/auth/change_password';
        const body = JSON.stringify({
            email: this.email.toLowerCase(),
            old_password: oldPassword,
            new_password: newPassword
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    authRequestReset( email: string): Observable<string> {
        console.log('#apiService#: authRequestReset()');
        const url = this.url + '/auth/request_reset_password';
        const body = JSON.stringify({
            email: email.toLowerCase()
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    authDeleteUser( password: string): Observable<object> {
        console.log('#apiService#: authDeleteUser()');
        const url = this.url + '/auth/delete_user';
        const body = JSON.stringify({
            email: this.email.toLowerCase(),
            password: password
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }

    loggingWriteLog( fileName: string, logObject: object): Observable<object> {
        console.log('#apiService#: loggingWriteLog()');
        const url = this.url + '/logging/write_log';
        const body = JSON.stringify({
            email: this.email,
            session_token: this.sessionToken,
            file_name: fileName,
            log_object: logObject
        });
        return this.http
            .post( url, body, {headers: this.jsonHeader})
            .map( response => response.json());
    }
}
