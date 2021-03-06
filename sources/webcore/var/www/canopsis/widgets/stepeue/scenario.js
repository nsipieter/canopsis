/*
#--------------------------------
# Copyright (c) 2011 "Capensis" [http://www.capensis.com]
#
# This file is part of Canopsis.
#
# Canopsis is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Canopsis is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Canopsis.  If not, see <http://www.gnu.org/licenses/>.
# ---------------------------------
*/
Ext.define('widgets.stepeue.scenario' , {
	alias: 'widget.stepeue.scenario',
	logAuthor: '[widget][stepeue][scenario]',
	scroll: true,
	useScreenShot: true,
	node: null,
	metrics: ['duration', 'failed'],
	aggregate_max_points: 100,
	graphHeight: 50,
	init: function(feature, scenario_name, widget ) {
		log.debug('Initialization of scenario ['+ scenario_name + '] for feature ['+ feature + ']' , this.logAuthor);
		this.scenarios = new Array();
		this.feature = feature;
		this.name = scenario_name;
		this.widget = widget;
	},
	putMainScenario: function(node ) {
		log.debug('Main scenario defined', this.logAuthor);
		this.mainScenario = node;
	},
	addScenario: function(node ) {
		log.debug('scenario added', this.logAuthor);
		var object = {
			browser: rdr_browser(node.raw.cntxt_browser),
			localization: rdr_country(node.raw.cntxt_localization),
			os: rdr_os(node.raw.cntxt_os),
			date: rdr_tstodate(node.raw.timestamp),
			cps_state: rdr_status(node.raw.state)
		};
                for (i in node.raw.perf_data_array) {
                        if (node.raw.perf_data_array[i].metric == 'duration')
                                duration = Math.round(node.raw.perf_data_array[i].value * 100) / 100;
                }
		object.dur = duration;
		this.scenarios.push(object);
	},
	getPerfData: function() {
		log.debug('find Perf Store Data of Scenario', this.logAuthor);
		var me = this;
                url = this.widget.urlPerfStore;
                post_params_tmp = new Array();
		for (i in this.metrics) {
	                var object = { id: getMetaId(this.mainScenario.raw.component, this.mainScenario.raw.resource, this.metrics[i]), 'metrics' : [this.metrics[i]] };
        	        post_params_tmp.push(object);
		}
                post_params = { 'nodes': Ext.JSON.encode(post_params_tmp), 'aggregate_max_points': this.aggregate_max_points };
                Ext.Ajax.request({
                        url: url,
                        scope: this,
                        params: post_params,
                        method: 'POST',
                        success: function(response) {
                                var data = Ext.JSON.decode(response.responseText);
				for (key in data.data) {
					var node = data.data[key];
					var unit = node['unit'];
					var metric = node['metric'];

					if (unit == undefined)
						unit = '';

					$('#' + me.widget.wcontainer.id + 'eue-' + node['node']).sparkline(node['values'], {
						type: 'line',
						height: this.graphHeight,
						unit: unit,
						metric: metric,
						chartRangeMinX: node['values'][0][0],
						chartRangeMaxX: node['values'][node['values'].length - 1][0],
						tooltipClassname: 'tooltip',
						tooltipFormatter: function(sparkline, options, fields) {
							return '<b>'+ rdr_tstodate(Math.round(fields['x'] / 1000)) + '</b><br>'+ options.userOptions.metric + ': '+ fields['y'] + ' '+ options.userOptions.unit;
						}
					});
				}
				log.debug('end of loading PerfData' , this.logAuthor);
                        },
                        failure: function(result, request) {
                                log.error('Ajax request failed ... (' + request.url + ')', this.logAuthor);
                        }
                });
	},
	buildMainView: function() {
		var arrayName = this.mainScenario.raw.resource.split('.');
		var scenarioName = arrayName[2];
		var loc = rdr_country(this.mainScenario.raw.cntxt_localization);
		var OSname = rdr_os(this.mainScenario.raw.cntxt_os);
		var browserName = rdr_browser(this.mainScenario.raw.cntxt_browser);
		var dte = rdr_tstodate(this.mainScenario.raw.timestamp);
		var duration;
		var state = rdr_status(this.mainScenario.raw.state);
		for (i in this.mainScenario.raw.perf_data_array) {
			if (this.mainScenario.raw.perf_data_array[i].metric == 'duration')
				duration = Math.round(this.mainScenario.raw.perf_data_array[i].value * 100) / 100;

		}
		return { cps_state: state, date: dte, scenario: scenarioName, localization: loc, os: OSname, browser: browserName, dur: duration };
	},
	getScreenShotLogo: function() {
                var imgObject = {
			src: '/rest/media/events/'+ this.mainScenario.raw._id,
                	width: '64px',
                	alt: 'the screenshot of the scenario can not be load' };
		var imageTpl = new Ext.XTemplate(
			'<a href="{src}" class="image-zoom">',
			'<img class="logo-screenshot" src="{src}" alt="{alt}" width="{width}" />',
			'</a>'
		);
		return imageTpl.applyTemplate(imgObject);
	},
	buildDetailsView: function() {
		log.debug('Build details view', this.logAuthor);
		var scenarData = this.scenarios;
                var storeScenar = Ext.create('Ext.data.Store', {
			fields: ['cps_state', 'date', 'scenario', 'localization', 'os', 'browser', 'dur'],
                        data: scenarData
                });

                var grid = Ext.create('Ext.grid.Panel', {
                        layout: 'fit',
			title: 'Other tests with this scenario ['+ this.name + ']',
                        columns: [
                                { header: 'Status', dataIndex: 'cps_state' },
                                { header: 'Date', dataIndex: 'date', align: 'center'},
                                { header: 'Localization', dataIndex: 'localization'},
                                { header: 'OS', dataIndex: 'os'},
                                { header: 'Browser', dataIndex: 'browser'},
                                { header: 'Duration', dataIndex: 'dur', align: 'center' }
                        ],
                        store: storeScenar
                });

		return [grid];

	}
});
