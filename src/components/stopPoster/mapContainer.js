import PropTypes from "prop-types";
import { gql, graphql } from "react-apollo";
import mapProps from "recompose/mapProps";
import compose from "recompose/compose";
import flatMap from "lodash/flatMap";
import { PerspectiveMercatorViewport } from "viewport-mercator-project";

import apolloWrapper from "util/apolloWrapper";
import { isNumberVariant, trimRouteId, isDropOffOnly } from "util/domain";
import { calculateStopsViewport } from "util/stopPoster";
import routeCompare from "util/routeCompare";

import Map from "./map";

const MAX_ZOOM = 19;
const MIN_ZOOM = 14;

const MINI_MAP_WIDTH = 450;
const MINI_MAP_HEIGHT = 360;
const MINI_MAP_ZOOM = 9;

const nearbyStopsQuery = gql`
    query nearbyStopsQuery($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!, $date: Date!) {
        stopGroups: stopGroupedByShortIdByBbox(minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon) {
            nodes {
                stopIds
                lat
                lon
                nameFi
                nameSe
                stops {
                    nodes {
                        calculatedHeading
                        routeSegments: routeSegmentsForDate(date: $date) {
                            nodes {
                                routeId
                                hasRegularDayDepartures
                                pickupDropoffType
                                route {
                                    nodes {
                                        destinationFi
                                        destinationSe
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`;

const stopsMapper = stopGroup => ({
    ...stopGroup,
    // Assume all stops face the same way
    calculatedHeading: stopGroup.stops.nodes[0].calculatedHeading,
    routes: flatMap(stopGroup.stops.nodes, node =>
        node.routeSegments.nodes
            .filter(routeSegment => routeSegment.hasRegularDayDepartures === true)
            .filter(routeSegment => !isNumberVariant(routeSegment.routeId))
            .filter(routeSegment => !isDropOffOnly(routeSegment))
            .map(routeSegment => ({
                routeId: trimRouteId(routeSegment.routeId),
                destinationFi: routeSegment.route.nodes[0].destinationFi,
                destinationSe: routeSegment.route.nodes[0].destinationSe,
            }))).sort(routeCompare),
});

const nearbyStopsMapper = mapProps((props) => {
    const nearbyStops = props.data.stopGroups.nodes
        // Do not include current stop
        .filter(({ stopIds }) => !stopIds.includes(props.stopId))
        // Merge properties from mode-specific stops
        .map(stopsMapper)
        // Filter out stops with no departures
        .filter(stop => !!stop.routes.length);

    const { projectedStops, viewport } = calculateStopsViewport({
        longitude: props.longitude,
        latitude: props.latitude,
        width: props.width,
        height: props.height,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        stops: nearbyStops,
    });

    const mapOptions = {
        center: [props.longitude, props.latitude],
        width: props.width,
        height: props.height,
        zoom: viewport.zoom,
    };

    const miniMapOptions = {
        center: [props.longitude, props.latitude],
        width: MINI_MAP_WIDTH,
        height: MINI_MAP_HEIGHT,
        zoom: MINI_MAP_ZOOM,
    };

    return {
        stops: projectedStops,
        pixelsPerMeter: viewport.getDistanceScales().pixelsPerMeter[0],
        mapOptions,
        miniMapOptions,
        date: props.date,
    };
});

const mapPositionQuery = gql`
    query mapPositionQuery($stopId: String!) {
        stop: stopByStopId(stopId: $stopId) {
            stopId
            lat
            lon
        }
    }
`;

const mapPositionMapper = mapProps((props) => {
    const longitude = props.data.stop.lon;
    const latitude = props.data.stop.lat;
    const viewport = new PerspectiveMercatorViewport({
        longitude,
        latitude,
        width: props.width,
        height: props.height,
        zoom: MIN_ZOOM,
    });
    const [minLon, minLat] = viewport.unproject([0, 0]);
    const [maxLon, maxLat] = viewport.unproject([props.width, props.height]);
    return { ...props, longitude, latitude, minLat, minLon, maxLat, maxLon };
});


const hoc = compose(
    graphql(mapPositionQuery),
    apolloWrapper(mapPositionMapper),
    graphql(nearbyStopsQuery),
    apolloWrapper(nearbyStopsMapper)
);

const MapContainer = hoc(Map);

MapContainer.propTypes = {
    stopId: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
};

export default MapContainer;
