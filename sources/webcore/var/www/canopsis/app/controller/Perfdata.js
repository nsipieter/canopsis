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
Ext.define('canopsis.controller.Perfdata', {
	extend: 'canopsis.lib.controller.cgrid',

	views: ['Perfdata.Grid'],
	stores: ['Perfdatas'],
	models: ['Perfdata'],

	init: function() {
		log.debug('Initialize ...', this.logAuthor);

		this.listXtype = 'PerfdataGrid';

		this.modelId = 'Perfdata';

		this.callParent(arguments);
	},

	_bindGridEvents: function(grid) {
		this.callParent(arguments);

		var btns = Ext.ComponentQuery.query('#' + this.grid.id + ' [action=toggle_internal_metric]');
		for (var i in btns)
			btns[i].on('click', this.grid.store.toggle_internal_metric, this.grid.store);

		var btns = Ext.ComponentQuery.query('#' + this.grid.contextMenu.id + ' [action=clean]');
		for (var i in btns)
			btns[i].on('click', this._clean, this);

		var btns = Ext.ComponentQuery.query('#' + this.grid.contextMenu.id + ' [action=clean_all]');
		for (var i in btns)
			btns[i].on('click', this._clean_all, this);
	},

	_clean: function() {
		log.debug('Clicked clean Button', this.logAuthor);
		var grid = this.grid;

		var selection = grid.getSelectionModel().getSelection();
		if (selection) {
			var cleaned_selection = [];
			for (i in selection)
				cleaned_selection.push(selection[i].raw._id);

			Ext.Ajax.request({
				url: '/perfstore/clean',
				params: Ext.encode(cleaned_selection),
				success: function(response) {
					var text = response.responseText;
					global.notify.notify('Perfdata Cleaned', 'Perfdatas have been cleaned', 'success');
				}
			});
		}
	},

	_clean_all: function() {
		log.debug('Clicked clean all Button', this.logAuthor);
		var grid = this.grid;

		Ext.Ajax.request({
			method: 'POST',
			url: '/perfstore/clean_all',
			success: function(response) {
				var text = response.responseText;
				global.notify.notify('Perfdata Cleaned', 'Perfdatas have been cleaned', 'success');
			}
		});
	}


});
