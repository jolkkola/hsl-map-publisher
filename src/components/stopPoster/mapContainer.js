import { PropTypes } from "react";
import { gql, graphql } from "react-apollo";
import mapProps from "recompose/mapProps";
import getContext from "recompose/getContext";
import compose from "recompose/compose";
import flatMap from "lodash/flatMap";
import apolloWrapper from "util/apolloWrapper";
import { fetchMap } from "util/api";
import { isNumberVariant, trimRouteId, isDropOffOnly } from "util/domain";
import {
    MIN_ZOOM,
    MAP_WIDTH,
    MAP_HEIGHT,
    createViewport,
    calculateStopsViewport,
} from "util/stopPoster";
import routeCompare from "util/routeCompare";
import hslMapStyle from "hsl-map-style";

import Map from "./map";

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
            }))).sort(routeCompare),
});

const getClient = getContext({
    client: PropTypes.shape({
        query: PropTypes.func.isRequired,
    }).isRequired,
});

const nearbyStopsMapper = compose(getClient, mapProps((props) => {
    const { stops: stopGroups, viewport } = calculateStopsViewport(
        props.stop,
        props.data.stopGroups.nodes
    );

    const mapOptions = {
        center: [props.stop.lon, props.stop.lat],
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        zoom: viewport.zoom,
    };

    const mapStyle = hslMapStyle.generateStyle({
        lang: ["fi", "sv"],
        extensions: ["icons", "routes", "citybikes"],
        glyphsUrl: "http://kartat.hsl.fi/",
        sourcesUrl: "api.digitransit.fi/map/v1/",
    });

    const networkQuery = gql`
        query networkQuery($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!, $date: Date!) {
            network: networkByDateAsGeojson(date: $date, minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon)
        }
    `;

    const NETWORK_PADDING = 1000; // Padding in pixels

    const [minLon, minLat] = viewport.unproject([-NETWORK_PADDING, -NETWORK_PADDING]);
    const [maxLon, maxLat] = viewport.unproject([
        MAP_WIDTH + NETWORK_PADDING,
        MAP_HEIGHT + NETWORK_PADDING,
    ]);

    const map = props.client.query({
        query: networkQuery,
        variables: { minLat, minLon, maxLat, maxLon, date: props.date },
    }).then(({ data }) => {
        mapStyle.sources.routes = {
            type: "geojson",
            data: data.network,
        };

        return fetchMap(mapOptions, mapStyle);
    });

    const miniMapOptions = {
        center: [props.stop.lon, props.stop.lat],
        width: MINI_MAP_WIDTH,
        height: MINI_MAP_HEIGHT,
        zoom: MINI_MAP_ZOOM,
    };

    return {
        stop: props.stop,
        stops: stopGroups.map(stopsMapper),
        pixelsPerMeter: viewport.getDistanceScales().pixelsPerMeter[0],
        map,
        mapOptions,
        miniMap: fetchMap(miniMapOptions),
        miniMapOptions,
    };
}));

const MapWithNearbyStopsContainer = apolloWrapper(nearbyStopsMapper)(Map);

const MapWithNearbyStops = graphql(nearbyStopsQuery)(MapWithNearbyStopsContainer);

const mapPositionQuery = gql`
    query mapPositionQuery($stopId: String!) {
        stop: stopByStopId(stopId: $stopId) {
            stopId
            lat
            lon
        }
    }
`;

const propsMapper = mapProps((props) => {
    const viewport = createViewport(props.data.stop, MIN_ZOOM);
    const [minLon, minLat] = viewport.unproject([0, 0]);
    const [maxLon, maxLat] = viewport.unproject([MAP_WIDTH, MAP_HEIGHT]);

    return { stop: props.data.stop, minLat, minLon, maxLat, maxLon, date: props.date };
});

const MapContainer = apolloWrapper(propsMapper)(MapWithNearbyStops);

export default graphql(mapPositionQuery)(MapContainer);
