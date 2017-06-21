import React, { Component } from "react";
import PropTypes from "prop-types";
import sortBy from "lodash/sortBy";
import DottedLine from "components/dottedLine";
import { Row, Column, Image, Spacer } from "components/util";

import renderQueue from "util/renderQueue";
import { isTrunkRoute, getColor, getIcon, colorsByMode } from "util/domain";

import timeIcon from "icons/time.svg";

import styles from "./routes.css";

const MAX_COLUMNS = 6;

const Icon = props => <Image {...props} className={styles.icon}/>;

const DepartureIntervals = () => (
    <div className={styles.interval}>
        <Row>
            <Image className={styles.intervalIcon} src={timeIcon}/>
            <Column>
                <div className={styles.intervalTitle}>ma-pe päivällä</div>
                <div className={styles.intervalSubtitle}>må-fre dagtid</div>
            </Column>
            <div className={styles.intervalValue}>3-5 min</div>

            <Spacer width={10}/>
            <DottedLine color="#000" width={3} spacing={5} count={6}/>
            <Spacer width={7}/>

            <Column>
                <div className={styles.intervalTitle}>la-su päivisin</div>
                <div className={styles.intervalSubtitle}>lö-sö dagtid</div>
            </Column>
            <div className={styles.intervalValue}>8-10 min</div>
        </Row>
        <Spacer height={10}/>
        <DottedLine color="#ff6319" width={3} spacing={5} count={100} isHorizontal/>
    </div>
);

function replaceColor(src) {
    return `data:image/svg+xml;base64,${btoa(atob(src.replace("data:image/svg+xml;base64,", "")).replace("#D5E8FA", "#FFFFFF"))}`;
}

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
        renderQueue.remove(this, { success: true });
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
            renderQueue.remove(this, { success: false });
            return;
        }
        renderQueue.remove(this, { success: true });
    }

    render() {
        if (this.props.routes.length === 0) {
            console.error("No routes for stop"); // eslint-disable-line no-console
            renderQueue.remove(this, { success: false });
        }

        const sortedRoutes = sortBy(this.props.routes, route => !isTrunkRoute(route.routeId));
        const routesPerColumn = Math.ceil(this.props.routes.length / this.state.columns);

        let routeCount = 0;
        let columnIndex = 0;
        const routeColumns = [];
        // Split routes into groups
        sortedRoutes.forEach((route) => {
            if (routeCount >= routesPerColumn) {
                columnIndex++;
                routeCount = 0;
            }
            if (!routeColumns[columnIndex]) {
                routeColumns[columnIndex] = [];
            }
            routeColumns[columnIndex].push(route);
            // Trunk routes take up twice as much space
            routeCount += (isTrunkRoute(route.routeId) ? 2 : 1);
        });

        if (this.props.routes.some(route => isTrunkRoute(route.routeId))) {
            // TODO: This is a hack to set the background color for stops with trunk routes
            document.documentElement.style.setProperty("--background", colorsByMode.TRUNK);
            document.documentElement.style.setProperty("--light-background", "#FFE0D1");

            const footer = document.getElementById("footerIcon");

            if (footer) {
                footer.src = replaceColor(footer.src);
            }
        }

        return (
            <div className={styles.root} ref={(ref) => { this.root = ref; }}>
                {routeColumns.map((routes, i) => {
                    const hasTrunkRoutes = routes.some(({ routeId }) => isTrunkRoute(routeId));

                    return (
                        <Row key={i} style={hasTrunkRoutes ? { width: 500 } : null}>
                            <Column>
                                {routes.map((route, index) => (
                                    <div>
                                        <div key={index} className={styles.group}>
                                            <Icon src={getIcon(route)}/>
                                        </div>
                                        {isTrunkRoute(route.routeId) &&
                                            <div className={styles.group}>
                                                <DepartureIntervals/>

                                            </div>
                                        }
                                    </div>
                                ))}
                            </Column>
                            <Column>
                                {routes.map((route, index) => (
                                    <div key={index}>
                                        <div className={styles.group}>
                                            <div
                                                className={styles.id}
                                                style={{ color: getColor(route) }}
                                            >
                                                {route.routeId}
                                            </div>
                                        </div>
                                        {isTrunkRoute(route.routeId) &&
                                            <div className={styles.group}/>
                                        }
                                    </div>
                                ))}
                            </Column>
                            <Column>
                                {routes.map((route, index) => (
                                    <div>
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
                                        {isTrunkRoute(route.routeId) &&
                                            <div className={styles.group}/>
                                        }
                                    </div>
                                ))}
                            </Column>
                        </Row>
                    );
                })}
            </div>
        );
    }
}

Routes.propTypes = {
    routes: PropTypes.arrayOf(
        PropTypes.shape({
            routeId: PropTypes.string.isRequired,
            destinationFi: PropTypes.string.isRequired,
            destinationSe: PropTypes.string.isRequired,
        })
    ).isRequired,
};

export default Routes;
