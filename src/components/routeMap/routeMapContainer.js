import compose from "recompose/compose";
import withStateHandlers from "recompose/withStateHandlers";
import lifecycle from "recompose/lifecycle";
import PropTypes from "prop-types";
import { graphql } from "react-apollo";
import mapProps from "recompose/mapProps";
import gql from "graphql-tag";
import { PerspectiveMercatorViewport } from "viewport-mercator-project";
import { trimRouteId, isSubwayRoute, isRailRoute } from "util/domain";
import apolloWrapper from "util/apolloWrapper";
import fetchStations from "../../util/overpassAPI";

import routeGeneralizer from "../../util/routeGeneralizer";
import RouteMap from "./routeMap";

const mapPositionMapper = mapProps((props) => {
    const { latitude, longitude } = props;
    const viewport = new PerspectiveMercatorViewport({
        longitude,
        latitude,
        width: props.width,
        height: props.height,
        zoom: props.zoom,
    });

    const [minLon, minLat] = viewport.unproject([0, 0], { topLeft: true });
    const [maxLon, maxLat] = viewport.unproject([props.width, props.height], { topLeft: true });
    return {
        ...props, minLat, minLon, maxLat, maxLon,
    };
});

const nearbyTerminals = gql`
    query nearbyTerminals($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!, $date: Date!) {
        terminals: terminalsByBbox(minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon) {
            nodes {
                nameFi
                nameSe
                lat
                lon
                modes {
                    nodes
                }
            }
        },
        terminus: terminusByDateAndBboxGrouped(date: $date, minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon) {
            nodes {
                lines
                stopAreaId
                lon
                lat
                terminalId
                nameFi
                nameSe
            }
        },
        intermediates: routeSectionIntermediates(date: $date, minLat: $minLat, minLon: $minLon, maxLat: $maxLat, maxLon: $maxLon) {
            nodes {
              routes,
              lon,
              lat,
              angle,
              length
            }
        },
    },
`;

const mapOverpassData = (data, props) => {
    const { latitude, longitude } = props;
    const viewport = new PerspectiveMercatorViewport({
        longitude,
        latitude,
        width: props.width,
        height: props.height,
        zoom: props.zoom,
    });

    return data.elements.map((el) => {
        const [x, y] = viewport.project([el.lon, el.lat]);
        return {
            lat: el.lat,
            lon: el.lon,
            nameFi: el.tags["name:fi"],
            nameSe: el.tags["name:sv"],
            x,
            y,
            type: el.tags.station,
        };
    });
};

const terminalMapper = mapProps((props) => {
    const terminals = props.data.terminals.nodes;
    const terminuses = props.data.terminus.nodes;
    const intermediates = props.data.intermediates.nodes;
    const { latitude, longitude } = props;

    const viewport = new PerspectiveMercatorViewport({
        longitude,
        latitude,
        width: props.width,
        height: props.height,
        zoom: props.zoom,
    });

    const projectedTerminals = terminals
        .filter(stop => stop.modes && stop.modes.nodes && stop.modes.nodes.length)
        .map((stop) => {
            const [x, y] = viewport.project([stop.lon, stop.lat]);

            if (stop.modes.nodes.length > 1) {
                // eslint-disable-next-line no-console
                console.log(`We assume terminals to have one transportation node, however ${stop.nameFi} has several`);
            }

            return {
                nameFi: stop.nameFi,
                nameSe: stop.nameSe,
                node: stop.modes.nodes[0],
                x,
                y,
            };
        });

    const projectedIntermediates = intermediates
        .map(intermediate => ({
            ...intermediate,
            routes: intermediate.routes
                .filter(id => !isRailRoute(id) && !isSubwayRoute(id) && id !== null),
        }))
        .map(intermediate => ({
            ...intermediate,
            label: routeGeneralizer(intermediate.routes.map(id => trimRouteId(id))),
        }))
        .filter(intermediate =>
            intermediate.label.length < 50
            || (intermediate.length > 250 && intermediate.label.length < 100)
            || intermediate.length > 500)
        .map((intermediate) => {
            const [x, y] = viewport.project([intermediate.lon, intermediate.lat]);
            return {
                ...intermediate,
                x,
                y,
            };
        });

    const projectedTerminuses = terminuses
        .map((terminus) => {
            const [x, y] = viewport.project([terminus.lon, terminus.lat]);

            return {
                ...terminus,
                lines: terminus.lines.filter(id => !isRailRoute(id) && !isSubwayRoute(id)),
                x,
                y,
            };
        })
        .filter(terminus => terminus.lines.length > 0);

    const mapOptions = {
        center: [props.longitude, props.latitude],
        width: props.width,
        height: props.height,
        zoom: props.zoom,
    };

    const mapComponents = {
        text_fisv: { enabled: true },
        regular_routes: { enabled: true },
        regular_stops: { enabled: true },
        municipal_borders: { enabled: true },
    };

    return {
        projectedTerminalNames: props.projectedTerminalNames,
        mapOptions,
        mapComponents,
        projectedTerminals,
        projectedTerminuses,
        projectedIntermediates,
        date: props.date,
    };
});

const hoc = compose(
    mapPositionMapper,
    withStateHandlers(props => ({
        ...props,
        projectedTerminalNames: [],
    }), {
        onData: props => data => ({
            ...props,
            projectedTerminalNames: mapOverpassData(data, props),
        }),
    }),
    lifecycle({
        componentDidMount() {
            fetchStations(
                this.props.minLat,
                this.props.minLon,
                this.props.maxLat,
                this.props.maxLon
            )
                .then(data => this.props.onData(data));
        },
    }),
    graphql(nearbyTerminals),
    apolloWrapper(terminalMapper)
);

const RouteMapContainer = hoc(RouteMap);

RouteMapContainer.defaultProps = {
};

RouteMapContainer.propTypes = {
    date: PropTypes.string.isRequired,
};

export default RouteMapContainer;
