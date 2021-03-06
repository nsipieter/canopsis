#!/usr/bin/env python
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

#import logging
from crecord import crecord

from ctools import calcul_pct
import cevent

from caccount import caccount
#from cstorage import get_storage

from bson.code import Code

import time
import json
import logging

class cselector(crecord):
	def __init__(self, storage, _id=None, name=None, namespace='events', use_cache=True, record=None, cache_time=60, logging_level=None):
		self.type = 'selector'
		self.storage = storage
		
		if name and not _id:
			self._id = self.type + "." + storage.account._id + "." + name
			
		## Default vars
		self.namespace = namespace
		
		self.dostate = True
		self.state_algorithm = 0
		
		self.mfilter = {}
		self.include_ids = []
		self.exclude_ids = []
		self.changed = False
		self.rk = None
		
		self.use_cache = use_cache
		self.cache_time = cache_time
		self.cache = None
		
		self.last_resolv = None
		self.last_nb_records = 0
		
		self.last_event = None
		
		self.output_tpl="{cps_sel_state_0} Ok, {cps_sel_state_1} Warning, {cps_sel_state_2} Critical"

		self.sel_metric_prefix = "cps_sel_"
		self.sel_metric_name = self.sel_metric_prefix + "state_%s"
		
		self._ids = None
		
		self.logger = logging.getLogger('cselector')
		if logging_level:
			self.logger.setLevel(logging_level)
		
		## Init
		if not record:
			try:
				record = storage.get(self._id)
			except:
				record = None

		
		if record:
			self.logger.debug("Init from record.")
			crecord.__init__(self, record=record, storage=storage)
		else:
			self.logger.debug("Init new record.")
			crecord.__init__(self, name=name, _id=self._id, account=storage.account, type=self.type, storage=storage)
		
	def dump(self):
		self.data['include_ids']	= self.include_ids
		self.data['exclude_ids']	= self.exclude_ids
		self.data['mfilter']		= json.dumps(self.mfilter)
		self.data['namespace']		= self.namespace
		self.data['rk']				= self.rk
		self.data['output_tpl']		= self.output_tpl
		self.data['dostate']		= self.dostate
		self.data['state_algorithm']= self.state_algorithm

		return crecord.dump(self)

	def load(self, dump):
		crecord.load(self, dump)
		try:
			self.mfilter = json.loads(self.data['mfilter'])
		except:
			pass
		
		self.namespace		= self.data.get('namespace', self.namespace)
		self.rk 			= self.data.get('rk', self.rk)
		self.include_ids	= self.data.get('include_ids', self.include_ids)
		self.exclude_ids	= self.data.get('exclude_ids',self.exclude_ids)
		self.dostate		= self.data.get('dostate', self.dostate)
		self.state_algorithm= self.data.get('state_algorithm ', self.state_algorithm )
		output_tpl			= self.data.get('output_tpl', None)
		
		if output_tpl and output_tpl != "":
			self.output_tpl = output_tpl
		
	def setMfilter(self, filter):
		try:
			json.dumps(self.mfilter)
			self.mfilter = filter
			self.changed = True
		except:
			raise Exception('Invalid mfilter')
			
	def setExclude_ids(self, ids):
		self.exclude_ids = ids
		self.changed = True

	def setInclude_ids(self, ids):
		self.include_ids = ids
		self.changed = True
	
	## Build MongoDB for find ids
	def makeMfilter(self):
		self.logger.debug("Make filter:")
		(ifilter, efilter, mfilter) = ({}, {}, {})
		
		if self.include_ids:
			if len(self.include_ids) == 1:
				ifilter = {'_id': self.include_ids[0]}
			else:
				ifilter = {'_id': {'$in': self.include_ids}}
				
		if self.exclude_ids:
			if len(self.exclude_ids) == 1:
				efilter = {'_id': {'$ne': self.exclude_ids[0]}}
			else:
				efilter = {'_id': {'$nin': self.include_ids}}
				
		if self.mfilter:
			mfilter = self.mfilter
		
		self.logger.debug(" + ifilter: %s" % ifilter)
		self.logger.debug(" + efilter: %s" % efilter)
		self.logger.debug(" + mfilter: %s" % mfilter)
		
		## Tweaks
		if not mfilter and not ifilter and not efilter:
			self.logger.warning("%s: Invalid filter" % self.name)
			return None
		
		if mfilter and not ifilter and not efilter:
			return mfilter
			
		if not mfilter and ifilter and not efilter:
			return ifilter
			
		if not mfilter and not ifilter and efilter:
			return None
			
		if mfilter and ifilter and not efilter:
			return {"$or": [mfilter, ifilter]}
			
		if mfilter and not ifilter and efilter:
			return {"$and": [mfilter, efilter]}
			
		if not mfilter and ifilter and efilter:
			return {"$and": [ifilter, efilter]}
		
		## Universal case
		return {"$and": [{"$or": [mfilter, ifilter]}, efilter]}
	
	## Get all ids
	def resolv(self):
				
		def do_resolv(self):
			self.logger.debug("do_resolv:")
			ids = []
			mfilter = self.makeMfilter()
			self.logger.debug(" + filter: %s" % mfilter)
			if not mfilter:
				self.logger.debug("  + Invalid mfilter" )
				return []
			self.logger.debug(" + namespace: %s" % self.namespace)
			
			records = self.storage.find(mfilter=mfilter, namespace=self.namespace)
			for record in records:
				if not record._id in ids:
					ids.append(record._id)
		
			self.last_resolv = time.time()
			self.last_nb_records = len(ids)
			
			self.storage.update(self._id, {'ids': ids})
			
			self.changed = False
			
			return ids
		
		if self.changed or self._ids == None:
			self.logger.debug("Selector has change, get new ids")
			self._ids = do_resolv(self)
		
		elif self.use_cache and self.last_resolv:
			if (time.time() - self.last_resolv) < self.cache_time:
				self.logger.debug(" + Use cache")
				return self._ids
			
		self._ids = do_resolv(self)
		return self._ids
	
	def match(self, _id):
		ids = self.resolv()
		return _id in ids
		
	def getRecords(self):
		ids = self.resolv()
		return self.storage.get(ids, namespace=self.namespace)
	
	def getState(self):
		self.logger.debug("getStates:")
		
		if len(self.include_ids) == 1 and not self.exclude_ids and not self.exclude_ids:
			states = {}
			record = self.storage.get(self.include_ids[0], namespace=self.namespace)
			states[int(record.data["state"])] = 1
			
		else:	
			# Build MongoDB filter		
			mfilter = self.makeMfilter()
			
			# Check filter
			self.logger.debug(" + filter: %s" % mfilter)
			if not mfilter:
				self.logger.debug("  + Invalid filter" )
				return ({}, 3, 1)
			
			# Build Map / Reduce	
			mmap = Code("function () {"
			"	var state = this.state;"
			"	if (this.state_type == 0) {"
			"		state = this.previous_state"
			"	}"
			"	if (this.source_type == 'host'){"
			"		if (state == 0){ emit(0, 1) }"
			"		else if (state == 1){ emit(2, 1) }"
			"		else if (state == 2){ emit(3, 1) }"
			"		else if (state == 3){ emit(3, 1) }"
			"	}"
			"	else {"
			"		emit(state, 1)"
			"	}"
			"}")

			mreduce = Code("function (key, values) {"
			"  var total = 0;"
			"  for (var i = 0; i < values.length; i++) {"
			"    total += values[i];"
			"  }"
			"  return total;"
			"}")
			
			# Map / Reduce
			states = self.storage.map_reduce(mfilter, mmap, mreduce, namespace=self.namespace)
		
		self.logger.debug(" + namespace: %s" % self.namespace)
		self.logger.debug(" + states: %s" % states)
		
		# Define state
		self.logger.debug(" + state algorithm: %s" % self.state_algorithm)
		if self.state_algorithm == 0:
			(state, state_type) = self.stateRule_morebadstate(states)
		else:
			raise Exception('Invalid state algorithm')
		
		return (states, state, state_type)
		
	def event(self):
		### Transform Selector to Canopsis Event
		self.logger.debug("To Event:")
		
		# Get state
		(states, state, state_type) = self.getState()
		
		# Build output
		total = 0		
		for s in states:
			states[s] = int(states[s])
			total += states[s]
		
		self.logger.debug(" + state: %s" % state)
		self.logger.debug(" + state_type: %s" % state_type)
		
		perf_data_array = []
		long_output = ""
		output = ""
			
		self.logger.debug(" + total: %s" % total)
		
		# Create perfdata array
		output_data = {}
		for i in [0, 1, 2, 3]:
			value = 0
			try:
				value = states[i]
			except:
				pass
			
			metric =  self.sel_metric_name % i
			output_data[metric] = value
			perf_data_array.append({"metric": metric, "value": value, "max": total})
		
		perf_data_array.append({"metric": self.sel_metric_prefix + "total", "value": total})
		
		# Counte components and resources
		mfilter = self.makeMfilter()
		if mfilter:
		
			sel_nb_component = self.storage.count(mfilter={'$and': [ mfilter, {'source_type': 'component'}]}, namespace=self.namespace)
			sel_nb_resource = self.storage.count(mfilter={'$and': [ mfilter, {'source_type': 'resource'}]}, namespace=self.namespace)		
			
			if sel_nb_component + sel_nb_resource == total:
				perf_data_array.append({"metric": self.sel_metric_prefix + "component", "value": sel_nb_component, 'max': total})
				perf_data_array.append({"metric": self.sel_metric_prefix + "resource", "value": sel_nb_resource, 'max': total})
			else:
				self.logger.error("Invalid count: component: %s, resource: %s, total: %s" % (sel_nb_component, sel_nb_resource, total))
		
		output_data['total'] = total
	
		# Fill Output template
		self.logger.debug(" + output TPL: %s" % self.output_tpl)
		output = self.output_tpl
		if output_data:
			for key in output_data:
				output = output.replace("{%s}" % key, str(output_data[key]))
		
		display_name = self.data.get("display_name", None)
		
		# Debug
		self.logger.debug(" + Display Name: %s" % display_name)
		self.logger.debug(" + output: %s" % output)
		self.logger.debug(" + long_output: %s" % long_output)
		self.logger.debug(" + perf_data_array: %s" % perf_data_array)
		
		# Build Event
		event = cevent.forger(
			connector = "selector",
			connector_name = "engine",
			event_type = "selector",
			source_type="component",
			component=self.name,
			#resource=None,	
			state=state,
			state_type=state_type,
			output=output,
			long_output=long_output,
			perf_data=None,
			perf_data_array=perf_data_array,
			display_name=display_name
		)
				
		# Extra field
		event["selector_id"] = self._id
		
		# Build RK
		rk = cevent.get_routingkey(event)
		
		# Save RK
		if not self.rk:
			self.logger.debug("Set RK to '%s'" % rk)
			self.storage.update(self._id, {'rk': rk})
			self.rk = rk
				
		# Cache event
		self.last_event = event
				
		return (rk, event)

	def stateRule_morebadstate(self, states):
		state = 0
		## Set state
		for s in [0, 1, 2]:
			try:
				if states[s]:
					state = s
			except:
				pass
		return (state, 1)
