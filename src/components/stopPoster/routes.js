import React, { Component } from "react";
import PropTypes from "prop-types";
import chunk from "lodash/chunk";
import sortBy from "lodash/sortBy";
import { Row, Column, InlineSVG } from "components/util";

import renderQueue from "util/renderQueue";
import { isTrunkRoute, getColor, getIcon } from "util/domain";

import styles from "./routes.css";

const MAX_COLUMNS = 6;

class Routes extends Component {
    constructor(props) {
        super(props);
        this.state = { columns: MAX_COLUMNS };
    }

    componentDidMount() {
        this.updateLayout();
    }

    componentWillReceiveProps() {
        this.setState({ columns: MAX_COLUMNS });
    }

    componentDidUpdate() {
        this.updateLayout();
    }

    componentWillUnmount() {
        renderQueue.remove(this);
    }

    hasOverflow() {
        return (this.root.scrollWidth > this.root.clientWidth);
    }

    updateLayout() {
        if (this.hasOverflow()) {
            if (this.state.columns > 1) {
                renderQueue.add(this);
                this.setState({ columns: this.state.columns - 1 });
                return;
            }
            renderQueue.remove(this, { error: new Error("Failed to remove routes overflow") });
            return;
        }
        renderQueue.remove(this);
    }

    render() {
        const routesPerColumn = Math.ceil(this.props.routes.length / this.state.columns);
        const routeColumns = chunk(
            sortBy(this.props.routes, route => !isTrunkRoute(route.routeId)),
            routesPerColumn
        );

        return (
            <div className={styles.root} ref={(ref) => { this.root = ref; }}>
                {routeColumns.map((routes, i) => (
                    <Row key={i}>
                        <Column>
                            {routes.map((route, index) => (
                                <div key={index} className={styles.group}>
                                    <InlineSVG className={styles.icon} src={getIcon(route)}/>
                                </div>
                            ))}
                        </Column>
                        <Column>
                            {routes.map((route, index) => (
                                <div key={index} className={styles.group}>
                                    <div className={styles.id} style={{ color: getColor(route) }}>
                                        {route.routeId}
                                    </div>
                                </div>
                            ))}
                        </Column>
                        <Column>
                            {routes.map((route, index) => (
                                <div
                                    key={index}
                                    className={styles.group}
                                    style={{ color: getColor(route) }}
                                >
                                    <div className={styles.title}>
                                        {route.destinationFi}
                                    </div>
                                    <div className={styles.subtitle}>
                                        {route.destinationSe}
                                    </div>
                                </div>
                            ))}
                        </Column>
                    </Row>
                ))}
            </div>
        );
    }
}

Routes.propTypes = {
    routes: PropTypes.arrayOf(PropTypes.shape({
        routeId: PropTypes.string.isRequired,
        destinationFi: PropTypes.string.isRequired,
        destinationSe: PropTypes.string,
    })).isRequired,
};

export default Routes;
