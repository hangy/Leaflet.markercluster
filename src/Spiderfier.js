import { Path, Polyline, Point, Browser, Util } from 'leaflet';

export class Spiderfier {
    constructor(clusterGroup, animated = true) {
        this._group = clusterGroup;
        this._animated = animated;
        this._spiderfied = null;
        this._2PI = Math.PI * 2;
        this._circleFootSeparation = 25;
        this._circleStartAngle = 0;
        this._spiralFootSeparation = 28;
        this._spiralLengthStart = 11;
        this._spiralLengthFactor = 5;
        this._circleSpiralSwitchover = 9;
    }

    spiderfy(cluster) {
        if (this._spiderfied === cluster || this._group._inZoomAnimation) return;
        const childMarkers = cluster.getAllChildMarkers(null, true);
        const map = this._group._map;
        let center = map.latLngToLayerPoint(cluster._latlng);
        let positions;
        this.unspiderfy();
        this._spiderfied = cluster;
        if (this._group.options.spiderfyShapePositions) {
            positions = this._group.options.spiderfyShapePositions(childMarkers.length, center);
        } else if (childMarkers.length >= this._circleSpiralSwitchover) {
            positions = this._generatePointsSpiral(childMarkers.length, center);
        } else {
            center.y += 10;
            positions = this._generatePointsCircle(childMarkers.length, center);
        }
        if (this._animated) {
            this._animationSpiderfy(cluster, childMarkers, positions);
        } else {
            this._noanimationSpiderfy(cluster, childMarkers, positions);
        }
    }

    unspiderfy(zoomDetails) {
        if (this._group._inZoomAnimation) return;
        if (this._spiderfied) {
            if (this._animated) {
                this._animationUnspiderfy(this._spiderfied, zoomDetails);
            } else {
                this._noanimationUnspiderfy(this._spiderfied);
            }
            this._spiderfied = null;
        }
    }

    _generatePointsCircle(count, centerPt) {
        const circumference = this._group.options.spiderfyDistanceMultiplier * this._circleFootSeparation * (2 + count);
        let legLength = circumference / this._2PI;
        const angleStep = this._2PI / count;
        const res = new Array(count);
        legLength = Math.max(legLength, 35);
        for (let i = 0; i < count; i++) {
            const angle = this._circleStartAngle + i * angleStep;
            res[i] = new Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle))._round();
        }
        return res;
    }

    _generatePointsSpiral(count, centerPt) {
        const spiderfyDistanceMultiplier = this._group.options.spiderfyDistanceMultiplier;
        let legLength = spiderfyDistanceMultiplier * this._spiralLengthStart;
        const separation = spiderfyDistanceMultiplier * this._spiralFootSeparation;
        const lengthFactor = spiderfyDistanceMultiplier * this._spiralLengthFactor * this._2PI;
        let angle = 0;
        const res = new Array(count);
        for (let i = count; i >= 0; i--) {
            if (i < count) {
                res[i] = new Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle))._round();
            }
            angle += separation / legLength + i * 0.0005;
            legLength += lengthFactor / angle;
        }
        return res;
    }

    _animationSpiderfy(cluster, childMarkers, positions) {
        const group = this._group;
        const map = group._map;
        const fg = group._featureGroup;
        const thisLayerLatLng = cluster._latlng;
        const thisLayerPos = map.latLngToLayerPoint(thisLayerLatLng);
        const svg = Path.SVG;
        const legOptions = Util.extend({}, group.options.spiderLegPolylineOptions);
        let finalLegOpacity = legOptions.opacity;
        if (finalLegOpacity === undefined) finalLegOpacity = 0.5;
        if (svg) {
            legOptions.opacity = 0;
            legOptions.className = (legOptions.className || '') + ' leaflet-cluster-spider-leg';
        } else {
            legOptions.opacity = finalLegOpacity;
        }
        group._ignoreMove = true;
        for (let i = 0; i < childMarkers.length; i++) {
            const m = childMarkers[i];
            const newPos = map.layerPointToLatLng(positions[i]);
            const leg = new Polyline([thisLayerLatLng, newPos], legOptions);
            map.addLayer(leg);
            m._spiderLeg = leg;
            m._preSpiderfyLatlng = m._latlng;
            m.setLatLng(newPos);
            if (m.setZIndexOffset) m.setZIndexOffset(1000000);
            if (m.clusterHide) m.clusterHide();
            fg.addLayer(m);
            if (m._setPos) m._setPos(thisLayerPos);
        }
        group._forceLayout?.();
        group._animationStart?.();
        for (let i = childMarkers.length - 1; i >= 0; i--) {
            const m = childMarkers[i];
            const newPos = map.layerPointToLatLng(positions[i]);
            m.setLatLng(newPos);
            if (m.clusterShow) m.clusterShow();
            if (svg) {
                const leg = m._spiderLeg;
                const legPath = leg._path;
                legPath.style.strokeDashoffset = 0;
                leg.setStyle({ opacity: finalLegOpacity });
            }
        }
        cluster.setOpacity(0.3);
        group._ignoreMove = false;
        setTimeout(() => {
            group._animationEnd?.();
            group.fire('spiderfied', { cluster, markers: childMarkers });
        }, 200);
    }

    _animationUnspiderfy(cluster, zoomDetails) {
        const group = this._group;
        const map = group._map;
        const fg = group._featureGroup;
        const thisLayerPos = zoomDetails ? map._latLngToNewLayerPoint(cluster._latlng, zoomDetails.zoom, zoomDetails.center) : map.latLngToLayerPoint(cluster._latlng);
        const childMarkers = cluster.getAllChildMarkers(null, true);
        const svg = Path.SVG;
        group._ignoreMove = true;
        group._animationStart?.();
        cluster.setOpacity(1);
        for (let i = childMarkers.length - 1; i >= 0; i--) {
            const m = childMarkers[i];
            if (!m._preSpiderfyLatlng) continue;
            m.closePopup?.();
            m.setLatLng(m._preSpiderfyLatlng);
            delete m._preSpiderfyLatlng;
            let nonAnimatable = true;
            if (m._setPos) {
                m._setPos(thisLayerPos);
                nonAnimatable = false;
            }
            if (m.clusterHide) {
                m.clusterHide();
                nonAnimatable = false;
            }
            if (nonAnimatable) {
                fg.removeLayer(m);
            }
            if (svg) {
                const leg = m._spiderLeg;
                const legPath = leg._path;
                const legLength = legPath.getTotalLength() + 0.1;
                legPath.style.strokeDashoffset = legLength;
                leg.setStyle({ opacity: 0 });
            }
        }
        group._ignoreMove = false;
        setTimeout(() => {
            for (let i = childMarkers.length - 1; i >= 0; i--) {
                const m = childMarkers[i];
                if (!m._spiderLeg) continue;
                if (m.clusterShow) m.clusterShow();
                if (m.setZIndexOffset) m.setZIndexOffset(0);
                fg.removeLayer(m);
                map.removeLayer(m._spiderLeg);
                delete m._spiderLeg;
            }
            group._animationEnd?.();
            group.fire('unspiderfied', { cluster, markers: childMarkers });
        }, 200);
    }

    _noanimationSpiderfy(cluster, childMarkers, positions) {
        const group = this._group;
        const map = group._map;
        const fg = group._featureGroup;
        const legOptions = group.options.spiderLegPolylineOptions;
        group._ignoreMove = true;
        for (let i = 0; i < childMarkers.length; i++) {
            const newPos = map.layerPointToLatLng(positions[i]);
            const m = childMarkers[i];
            const leg = new Polyline([cluster._latlng, newPos], legOptions);
            map.addLayer(leg);
            m._spiderLeg = leg;
            m._preSpiderfyLatlng = m._latlng;
            m.setLatLng(newPos);
            if (m.setZIndexOffset) m.setZIndexOffset(1000000);
            fg.addLayer(m);
        }
        cluster.setOpacity(0.3);
        group._ignoreMove = false;
        group.fire('spiderfied', { cluster, markers: childMarkers });
    }

    _noanimationUnspiderfy(cluster) {
        const group = this._group;
        const map = group._map;
        const fg = group._featureGroup;
        const childMarkers = cluster.getAllChildMarkers(null, true);
        group._ignoreMove = true;
        cluster.setOpacity(1);
        for (let i = childMarkers.length - 1; i >= 0; i--) {
            const m = childMarkers[i];
            fg.removeLayer(m);
            if (m._preSpiderfyLatlng) {
                m.setLatLng(m._preSpiderfyLatlng);
                delete m._preSpiderfyLatlng;
            }
            if (m.setZIndexOffset) m.setZIndexOffset(0);
            if (m._spiderLeg) {
                map.removeLayer(m._spiderLeg);
                delete m._spiderLeg;
            }
        }
        group.fire('unspiderfied', { cluster, markers: childMarkers });
        group._ignoreMove = false;
    }

    onAdd() {
        const map = this._group._map;
        map.on('click', () => this.unspiderfy(), this);
        if (map.options.zoomAnimation) {
            map.on('zoomstart', () => this.unspiderfy(), this);
        }
        map.on('zoomend', () => this.unspiderfy(), this);
        if (!Browser.touch) {
            map.getRenderer(this._group);
        }
    }

    onRemove() {
        const map = this._group._map;
        map.off('click', () => this.unspiderfy(), this);
        map.off('zoomstart', () => this.unspiderfy(), this);
        map.off('zoomend', () => this.unspiderfy(), this);
        this.unspiderfy();
    }
}
