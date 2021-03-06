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
Ext.define('widgets.gauge.gauge' , {
	extend: 'canopsis.lib.view.cwidget',

	alias: 'widget.gauge',

	logAuthor: '[gauge]',

	colorStart: '#6FADCF',
	colorStop: '#8FC0DA', 
	gaugeColor: '#E1E6FA', 
	titleFontColor: '#3E576F',
	gaugeWidthScale: 1,
	showMinMax: true,
	shadowOpacity: 0.7,
	
	labelSize: 25,
	maxValue:100,
	minValue: 0,

	// Internals
	gauge: undefined,

	label: '',
	gaugeTitle: '',
	gaugeLabel: '',
	lastValue: 0,

	initComponent: function() {
		this.gaugeTitle = this.title
		this.title = ''
		this.callParent(arguments);
	},

	createGauge: function(){

		if (this.autoTitle)
			if (this.nodes.length){
				var component = this.nodes[0].component;
				var source_type = this.nodes[0].source_type;

				if (source_type == 'resource') {
					var resource = this.nodes[0].resource;
					this.gaugeTitle = resource + ' ' + _('on') + ' ' + component;
				}else {
					this.gaugeTitle = component;
				}
			}

		var opts = {
			id: this.wcontainerId,
			value: 0,
			gaugeWidthScale: this.gaugeWidthScale,
			titleFontColor: this.titleFontColor,
			showMinMax: this.showMinMax,
			levelColorsGradient: true,
			min: this.minValue,
			max: this.maxValue,
			shadowOpacity: this.shadowOpacity,
			title: this.gaugeTitle,
			label: this.gaugeLabel,
			levelColors: [this.colorStart, this.colorStop],
			gaugeColor: this.gaugeColor
		}

		log.debug("Gauge options:", this.logAuthor)
		log.dump(opts)

		this.gauge = new JustGage(opts);	
	},

	onResize: function() {
		log.debug('onRezize', this.logAuthor);

		delete this.gauge
		this.createGauge()
		this.gauge.refresh(this.lastValue)
	},

	getNodeInfo: function(from,to) {
		this.processNodes()
		if (this.nodeId) {
			Ext.Ajax.request({
				url: '/perfstore/values' + '/' + to + '/' + to,
				scope: this,
				params: this.post_params,
				method: 'POST',
				success: function(response) {
					var data = Ext.JSON.decode(response.responseText);
					if (this.nodeId.length > 1)
						data = data.data;
					else
						data = data.data[0];
					this._onRefresh(data);
				},
				failure: function(result, request) {
					log.error('Impossible to get Node informations, Ajax request failed ... (' + request.url + ')', this.logAuthor);
				}
			});
		}

	},

	processNodes: function() {
		var post_params = [];
		for (var i in this.nodes) 
			post_params.push({
				id: this.nodes[i].id,
				metrics: this.nodes[i].metrics
			});
		
		this.post_params = {
			'nodes': Ext.JSON.encode(post_params),
			'aggregate_method' : this.aggregate_method,
			'aggregate_interval': this.aggregate_interval,
			'aggregate_max_points': this.aggregate_max_points
			};
	},


	onRefresh: function(data) {
		log.debug('onRefresh', this.logAuthor);

		if (data){

			var fields = undefined
			if(this.nodes[0].extra_field)
				fields = this.nodes[0].extra_field

			if (data.min)
				this.minValue = data.min

			//update metric name
			if (fields && fields.label)
				this.gaugeLabel = fields.label
			else
				this.gaugeLabel = data.metric
					
			//update metric value
			var maxValue = this.maxValue
			if(fields && fields.ma){
				maxValue = fields.ma
			}else if(data.max){
				maxValue = data.max
			}
			this.maxValue = maxValue


			var minValue = this.minValue
			if(fields && fields.mi){
				minValue = fields.mi
			}else if(data.max){
				minValue = data.min
			}
			this.minValue = minValue

			try{
				if(data.values){
					if (! this.gauge)
						this.createGauge()

					this.lastValue = data.values[data.values.length - 1][1]
					this.gauge.refresh(Math.round(this.lastValue*100)/100)
				}
			}catch(err){
				log.error('Error while set value:' + err, this.logAuthor)
			}

		}else{
			log.debug('No data', this.logAuthor)
		}
	},

});
