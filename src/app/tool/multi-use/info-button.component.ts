import { Component, Input, ElementRef } from '@angular/core';

@Component({
    selector: 'info-button',
    templateUrl: './info-button.component.html',
    styleUrls: ['./info-button.component.scss']
})

export class InfoButtonComponent {
    @Input('text')
    text;
    @Input('arrowPos')
    arrowPos;

    config;

    constructor(
        private elem: ElementRef
    ){
    }

    openHint() {
        let config = {};
        let source = this.elem.nativeElement.getBoundingClientRect();
        console.log(source);
        config["x"] = source.left;
        config["y"] = source.top;
        config["arrowPos"] = this.arrowPos;
        config["text"] = this.text;
        this.config = config;
        console.log(this.config.y);
    }

    closeHint() {
        this.config = undefined;
    }
}
