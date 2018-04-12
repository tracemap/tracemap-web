import { 
    Component, 
    NgModule, 
    ViewEncapsulation, 
    Output, 
    EventEmitter,
    OnDestroy } from '@angular/core';
import * as d3 from 'd3';
import * as $ from 'jquery';
import { ActivatedRoute } from '@angular/router';

import { MainCommunicationService } from './../services/main.communication.service';
import { HighlightService } from './../services/highlight.service';
import { LocalStorageService } from './../services/local-storage.service';

@Component({
    selector: 'd3-component',
    encapsulation: ViewEncapsulation.None,
    templateUrl: './d3.component.html',
    styleUrls: ['./d3.component.scss']
})

export class D3Component implements OnDestroy{
    @Output()
    nodeClicked:EventEmitter<string> = new EventEmitter();
    @Output()
    svgClicked:EventEmitter<any> = new EventEmitter();

    loaded: boolean = false;
    highlight: string;

    simulations: string[] = ["default","time"];
    highlights: string[] = ["next","previous","both"];
    config = {
        simulate_by: "default",
        highlight_by: "both"
    };

    graphData = {
        "nodes": [],
        "links": []
    };

    canvas;
    context;
    dragging;
    simulation;
    width;
    height;

    hoveredNode;
    activeNode;

    colors = ["151,41,255","29,161,242"]
    scale = d3.scaleLinear().domain([2, 30]).range([6, 18]);

    constructor(
        private route: ActivatedRoute,
        private comService: MainCommunicationService,
        private highlightService: HighlightService,
        private storageService: LocalStorageService
    ){ 
        // this.comService.resetUserNodeHighlight.subscribe( userId => {
        //     this.resetHighlightNode();
        // });
        this.highlightService.highlight.subscribe( area => {
            if( area == "graph") {
                this.highlight = "highlight"
            } else {
                this.highlight = "";
            }
        });
        let storageConfig = this.storageService.getD3Config();
        for( let key in storageConfig) {
            this.config[key] = storageConfig[key];
        }
    }

    ngOnDestroy() {
        this.storageService.setD3Config(this.config);
    }

    transformLinear(): Promise<void> {
        return new Promise( (resolve) => {
            let nodesCount = this.graphData.nodes.length;
            this.graphData.nodes.sort( (a,b) => {
                return a.x - b.x;
            });
            let firstX = this.graphData.nodes[0].x;
            let lastX = this.graphData.nodes[nodesCount - 1].x;
            this.graphData.nodes.sort( (a,b) => {
                return a.y - b.y;
            });
            let firstY = this.graphData.nodes[0].y;
            let lastY = this.graphData.nodes[nodesCount - 1].y;
            let offset;
            if( firstY < firstX) {
                if( firstY <= 0) {
                    offset = Math.abs(firstY);
                } else {
                    offset = firstY * -1;
                }
            } else {
                if( firstX <= 0) {
                    offset = Math.abs(firstX);
                } else {
                    offset = firstX * -1;
                }
            }
            let multiplicator = ((lastX + offset) - (firstX + offset)) 
                                / this.width;
            if(( (lastY + offset) / multiplicator) > this.height) {
                multiplicator = ((lastY + offset) - firstY + offset)
                                / this.height;
            }
            this.canvas['multiplicator'] = multiplicator;
            this.canvas['offset'] = offset;
            this.graphData.nodes.forEach( node => {
                node['canvasX'] = (node.x + offset) / multiplicator;
                node['canvasY'] = (node.y + offset) / multiplicator;
            });
            resolve();
        })
    }

    ticked() {
        this.graphData.nodes.forEach( node => {
            let x = node.x;
            let y = node.y;
            let r = node.r;
            if( x < 0 + r) {
                node.x = 0 + r;
            } else if ( x > this.width - r) {
                node.x = this.width - r;
            }
            if( y < 0 + r) {
                node.y = 0 + r;
            } else if ( y > this.height - r) {
                node.y = this.height - r;
            }
        });
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.beginPath();
        this.graphData.links.filter( link => {
            if( link.opacity == 1) {
                return link;
            }
        }).forEach( link => this.drawLink(link));
        this.context.stroke();

        this.context.beginPath();
        this.graphData.links.filter( link => {
            if( link.opacity == 0.2) {
                return link;
            }
        }).forEach( link => this.drawLink(link));
        this.context.stroke();

        this.context.beginPath();
        this.graphData.nodes.forEach(node => {
           if(node.group == 1) {
               this.drawNode(node);
           } else {
               this.drawAuthor(node);
           } 
        });
    }

    resizeCanvas() {
        this.canvas.width = 0;
        this.canvas.height = 0;
        this.width = $('.canvas').width();
        this.height = $('.canvas').height();
        this.canvas = document.querySelector(".d3-graph");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context = this.canvas.getContext("2d");
        this.simulation.stop()
        this.setSimulation().then( (simulation) => {
            this.context.beginPath();
            this.simulation = simulation;
        });
    }

    render() {
        this.width = $('.canvas').width();
        this.height = $('.canvas').height();
        this.canvas = document.querySelector(".d3-graph");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context = this.canvas.getContext("2d");
        this.graphData.nodes.forEach( node => {
            node.r = this.scale(this.getNeighbours(node, "out")) * 1.6;
            node.opacity = 1.0;
            node.color = 0;
        });
        this.graphData.links.forEach( link => {
            link.opacity = 1.0;
        });
        this.addTimestamps();
        this.setSimulation().then( (simulation) => {
            this.simulation = simulation;
            d3.select(this.canvas)
                .call( d3.drag()
                    .container(this.canvas)
                    .subject( () => { return nodeHovered(this.canvas)})
                    .on("start", () => { return this.dragstarted() })
                    .on("drag", () => { return this.dragged()})
                    .on("end", () => { return this.dragended()}));
            d3.select(this.canvas)
                .on("mousemove", () => {
                    let node = nodeHovered(this.canvas);
                    if( node && !this.hoveredNode ) {
                        this.hoveredNode = node;
                        this.comService.userNodeHighlight.next(node.id_str);
                    } else if ( !node && 
                                this.hoveredNode && 
                                !this.dragging ){
                        this.comService.userNodeHighlight.next(undefined);
                    } else if ( nodeHovered(this.canvas) != this.hoveredNode &&
                                !this.dragging) {
                        let newNode = nodeHovered(this.canvas);
                        this.comService.userNodeHighlight.next(undefined);
                        this.comService.userNodeHighlight.next(newNode.id_str);
                    }
                })
                .on("click", () => {
                    let node = nodeHovered(this.canvas);
                    if( node) {
                        this.activeNode = node;
                        this.comService.userInfo.next(node.id_str);
                    } else if (!node) {
                        this.comService.userInfo.next(undefined);
                    }
                });

            function nodeHovered(canvas) {
                let mouse = d3.mouse(canvas);
                let x = mouse[0];
                let y = mouse[1];
                let node = simulation.find( x, y);
                return simulation.find( x, y, node.r);
            }

        });


        this.comService.userInfo.subscribe( userId => {
            if( userId) {
                this.graphData.nodes.forEach( node => {
                    if( node.id_str == userId) {
                        this.hoveredNode = undefined;
                        this.activeNode = node;
                        this.ticked();
                    }
                })
            } else {
                this.activeNode = undefined;
                this.ticked();
            }
        });
        this.comService.userNodeHighlight.subscribe( userId => {
            if( userId) {
                this.graphData.nodes.forEach( node => {
                    if( node.id_str == userId) {
                        this.hoveredNode = node;
                        this.highlightNeighbours(node, this.config.highlight_by);
                        this.ticked();
                    }
                });
            } else {
                this.resetHighlightNeighbours();
                this.hoveredNode = undefined;
                this.ticked();
            }
        }); 

    }


    addTimestamps() {
        this.graphData.nodes.forEach( node => {
            node.timestamp = Date.parse(node.retweet_created_at) / 1000;
        });
        this.graphData.nodes.sort( (a,b) => {
            return a.timestamp - b.timestamp;
        })
        let authorNode = this.graphData.nodes[0];
        let firstTime = authorNode.timestamp;
        let lastTime = this.graphData.nodes[this.graphData.nodes.length -1].timestamp;
        let multiplicator = (lastTime - firstTime) / (this.width - authorNode.r);
        this.graphData.nodes.forEach( node => {
            node.rel_timestamp = authorNode.r + ((node.timestamp - firstTime) / multiplicator);
        })
    }


    dragstarted() {
        this.dragging = true;
        if( !d3.event.active)
            this.simulation.alphaTarget(0.3).restart();
        if(this.config.simulate_by == "default") {
            d3.event.subject.fx = d3.event.subject.x;
        }
        d3.event.subject.fy = d3.event.subject.y;
    }

    dragged() {
        if(this.config.simulate_by == "default") {
            d3.event.subject.fx = d3.event.x;
        }
        d3.event.subject.fy = d3.event.y;
    }

    dragended() {
        this.dragging = false;
        if( !d3.event.active) 
            this.simulation.alphaTarget(0);
        let node = d3.event.subject;
        if( node.locked && node.locked == true) {
            node.fx = null;
            node.fy = null;
            node.locked = false;
        } else {
            node['locked'] = true;
        }
    }


    drawLink(d) {
        let angle = Math.atan2( d.target.y- d.source.y, 
                                d.target.x - d.source.x);
        let xPos = d.target.x - d.target.r * Math.cos(angle);
        let yPos = d.target.y - d.target.r * Math.sin(angle);
        this.context.moveTo(d.source.x, d.source.y);
        this.context.lineTo( xPos, yPos);
        this.context.strokeStyle = "rgba(140,140,140,"+d.opacity+")";
        this.context.lineWidth = 1;
        this.drawHead(xPos, yPos, angle)
    }

    drawHead(xPos, yPos, angle) {
        let headlen = 5;
        let headRightX = xPos - headlen * Math.cos(angle - Math.PI/6);
        let headRightY = yPos - headlen * Math.sin(angle - Math.PI/6); 
        this.context.lineTo( headRightX, headRightY);
        this.context.moveTo( xPos, yPos);
        let headLeftX = xPos - headlen * Math.cos(angle + Math.PI/6);
        let headLeftY = yPos - headlen * Math.sin(angle + Math.PI/6); 
        this.context.lineTo( headLeftX, headLeftY);

    }

    drawNode(d) {
        if( d == this.activeNode || d == this.hoveredNode) {
            d.color = 1;
        } else {
            d.color = 0;
        }
        let lineWidth = d.r / 7;
        let radius = d.r - lineWidth;
        this.context.beginPath();
        this.context.moveTo( d.x + radius, d.y)
        this.context.arc(d.x, d.y, radius, 0, 2*Math.PI);
        this.context.lineWidth = lineWidth;
        this.context.fillStyle = "rgba("+this.colors[d.color]+","+d.opacity+")";
        this.context.strokeStyle = "rgba("+this.colors[d.color]+","+d.opacity+")";
        this.context.fill();
        this.context.stroke();
    }

    drawAuthor(d) {
        if( d == this.activeNode || d == this.hoveredNode) {
            d.color = 1;
        } else {
            d.color = 0;
        }
        let lineWidth = d.r / 7;
        let radius = d.r - lineWidth;
        this.context.beginPath();
        this.context.moveTo( d.x + radius, d.y)
        this.context.arc(d.x, d.y, radius, 0, 2*Math.PI);
        this.context.moveTo( d.x + radius / 2, d.y)
        this.context.arc(d.x, d.y, radius / 2, 0, 2*Math.PI);
        this.context.lineWidth = lineWidth;
        this.context.fillStyle = "#fff";
        this.context.strokeStyle = "rgba("+this.colors[d.color]+","+d.opacity+")";
        this.context.fill();
        this.context.stroke();
    }

    drawTimeline() {

    }

    generateTimeline() {
        let start = this.graphData.nodes[0].retweet_created_at;
        let end = this.graphData.nodes[this.graphData.nodes.length -1].retweet_created_at;
    }

    changeConfig(key, value) {
        this.config[key] = value;
        this.storageService.setD3Config(this.config);
        if( key == "simulate_by") {
            this.setSimulation();
        }
    }

    setSimulation(): Promise<d3.forceSimulation> {
        return new Promise( (resolve, reject) => {
            if( this.config.simulate_by == "default") {
                this.simulateDefault().then( (simulation) => {
                    resolve(simulation);
                });
            } else if( this.config.simulate_by == "time") {
                this.simulateTime().then( (simulation) => {
                    this.generateTimeline();
                    resolve(simulation);
                });
            }
        });
    }

    simulateDefault(): Promise<d3.forceSimulation> {
        return new Promise((resolve, reject) => {
            this.graphData.nodes.forEach( node => {
                if( node.group == 0) {
                    node.fx = this.width / 2;
                    node.fy = this.height / 2;
                } else {
                    delete node.fx;
                }
            });

            let simulation = d3.forceSimulation()
                .force("link", d3.forceLink().id(function(d) {
                    return d.id_str; 
                }).distance(function(d) {
                    let sourceRad = d.source.r;
                    let targetRad = d.target.r;
                    return (sourceRad + targetRad);
                }))
                .force("charge", d3.forceManyBody()
                                   .strength( (d) => {
                                       return d.r * -20;
                                   }))
                .force("collide", d3.forceCollide().radius(function(d) {
                    return d.r * 1.5;
                }))
                .force("center", d3.forceCenter(this.width / 2, this.height / 2));

            simulation
                .nodes( this.graphData.nodes)
                .on( "tick", () => { return this.ticked()});

            simulation.force("link")
                .links(this.graphData.links);
            resolve(simulation);
        });

    }

    simulateTime(): Promise<d3.forceSimulation> {
        return new Promise( (resolve, reject) => {
            this.addTimestamps();
            this.graphData.nodes.forEach( node => {
                node.fx = node.rel_timestamp;
            });
            let simulation = d3.forceSimulation()
                .force("link", d3.forceLink().id(function(d) {
                    return d.id_str; 
                }).distance(function(d) {
                    let sourceY = d.source.y;
                    let targetY = d.target.y;
                    if(Math.abs(targetY - sourceY) < 10) {
                        d.target.y = d.source.y + 30;
                    }
                    return (d.source.r + d.target.r) * 2;
                }))
                .force("charge", d3.forceManyBody().strength(function(d) {
                    return d.r * -30;
                }));

            simulation
                .nodes( this.graphData.nodes)
                .on( "tick", () => { return this.ticked()});
            simulation.force("link")
                .links(this.graphData.links);
            resolve(simulation);
        });
    }

    highlightNeighbours( node, direction) {
        let childLinks;
        let children;
        let parentLinks;
        let parents;


        //set graphs opacity to 0.2
        this.graphData.nodes.forEach( node => {
            node.opacity = 0.2;
        });
        this.graphData.links.forEach( link => {
            link.opacity = 0.2;
        });
        //make neighbour links visible and create lists of children/parents
        if( direction=="both" || direction=="next") { 
            childLinks = this.graphData.links.filter( link => {
                if( link.source == node) {
                    link.opacity = 1;
                    return link;
                }
            });
            children = childLinks.map( link => {
                return link.target;
            });
        }
        if( direction=="both" || direction=="previous") {
            parentLinks = this.graphData.links.filter( link => {
                if( link.target == node) {
                    link.opacity = 1;
                    return link;
                }
            });
            parents = parentLinks.map( link => {
                return link.source;
            });
        }

        node.opacity = 1;
        //make neighbour nodes visible
        if( direction=="both" || direction=="next") {
            this.graphData.nodes.forEach( node => {
                if( children.indexOf(node) >= 0){
                    node.opacity = 1;
                }
            });
        }
        if( direction=="both" || direction=="previous") {
            this.graphData.nodes.forEach( node => {
                if( parents.indexOf(node) >= 0) {
                    node.opacity = 1;
                }
            });
        }
        this.ticked();        
    }

    resetHighlightNeighbours() {
        this.graphData.nodes.forEach( node => {
            node.opacity = 1;
        });
        this.graphData.links.forEach( link => {
            link.opacity = 1;
        });
        this.ticked();
    }

    getNeighbours(d, direction=undefined): number {
        let matches = [];
        this.graphData.links.forEach( link => {
            if( !direction || direction == "in") {
                if(link.target == d.id_str) {
                    matches.push(link);
                }
            }
            if(!direction || direction == "out") {
                if(link.source == d.id_str) {
                    matches.push(link);
                }
            }
        })
        return matches.length;
    }

    
}
