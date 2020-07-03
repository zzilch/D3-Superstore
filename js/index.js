// 文件位置
const jsonFile = './data/us-states.json'
const csvFile = './data/superstore-subset-processed.csv'
// 比例尺色系
const salesColors = d3.scaleQuantize().range([
	"#d9f0a3",
	"#addd8e",
	"#78c679",
	"#41ab5d",
	"#238443",
	"#005a32"
])
const profitColors = d3.scaleQuantize().range([
	'#D32F2F', '#E53935', '#F44336',
	'#EF5350', '#E57373', '#EF9A9A',
	'#BBDEFB', '#90CAF9', '#64B5F6',
	'#42A5F5', '#2196F3', '#1E88E5'
])
profitColors.domain([-1, 1])
// 格式转换
Number.prototype.formatMoney = function (c, d, t) {
	var n = this,
		c = isNaN(c = Math.abs(c)) ? 2 : c,
		d = d == undefined ? '.' : d,
		t = t == undefined ? ',' : t,
		s = n < 0 ? '-' : '',
		i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c))),
		j = (j = i.length) > 3 ? j % 3 : 0;
	return s + (j ? i.substr(0, j) + t : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + t) + (c ? d + Math.abs(n -
		i).toFixed(c).slice(2) : '');
}
function floorMoney(x) {
	if (Math.abs(x) > 1000) {
		return (x / 1000).toFixed(0) + 'K'
	} else if (Math.abs(x) > 100) {
		return (x / 100).toFixed(0) + '00'
	} else {
		return x.toFixed(0)
	}
}
// 提示工具
var tip = d3.tip()
	.attr('class', 'd3-tip')
	.offset([-10, 0])
	.html(function (state) {
		if (!!state.properties.profit) {
			var color = state.properties.profit >= 0 ? '#5fba7d' : 'red';
			return "<strong style='color:orange'>State:</strong> <span>" + state.properties.name + "</span>" +
				"</br><strong style='color:orange'>Sales:</strong> <span>" + state.properties.sales.formatMoney() + "$</span>" +
				"</br><strong style='color:orange'>Profit:</strong> <span style='color:" + color + "'>" + state.properties.profit
					.formatMoney() + "$</span>"

		} else {
			return 'no data'
		}
	})
// 主应用
var app = new Vue({
	el: '#app',
	// 应用变量
	data: {
		years: null,
		jsonData: null,
		csvData: null,
		currentState: null,
		currentType: null,
		maxProfit: null,
		minProfit: null,
		currentYear: null
	},
	// 应用载入时
	mounted() {
		d3.json(jsonFile).then((jsonData) => {
			this.jsonData = jsonData
			d3.csv(csvFile).then((csvData) => {
				this.csvData = csvData;
				this.drawMap()
				this.initData()
				this.setYear(this.currentYear)
			})
		})
	},
	// 应用方法
	methods: {
		// 绘制地图
		drawMap() {
			// 地图大小
			var width = document.getElementById('maparea').offsetWidth * 3 / 4
			var height = width * 3 / 4
			var map = d3.select("#map")
				.attr("width", width)
				.attr("height", height);
			var scale = 1280 * width / 960
			// 地图缩放
			var projection = d3.geoAlbersUsa()
				.scale(scale)
				.translate([width / 2, height / 2]);
			var path = d3.geoPath()
				.projection(projection);
			// 绑定提示工具
			map.call(tip)
			// 地图路径
			d3.select('#map').selectAll("path")
				.data(this.jsonData.features)
				.enter()
				.append("path")
				.attr('id', s => 'path-' + s.properties.name)
				.attr("d", path)
				.attr("stroke", "white")
				.attr("stroke-width", "1")
				.on('mouseover', tip.show) // 绑定鼠标事件
				.on('mouseout', tip.hide)
				.on("click", s => this.setState(s.properties.name))
		},
		// 更新颜色
		updateMap() {
			// 聚合函数
			function aggMap(groups) {
				var sales = 0.0;
				var profit = 0.0;
				groups.forEach(e => {
					profit += +e['Profit']
					sales += +e['Sales']
				});
				return {
					'profit': profit,
					'sales': sales
				}
			}
			// 数据聚合
			var currentData = d3.nest()
				.key(e => e['State'])
				.rollup(aggMap)
				.entries(this.csvDataThisYear())
			// 获取最值
			this.maxProfit = d3.max(currentData, state => state.value.profit)
			this.minProfit = d3.min(currentData, state => state.value.profit)
			var maxSales = d3.max(currentData, state => state.value.sales)
			var minSales = d3.min(currentData, state => state.value.sales)
			// 颜色定义域
			salesColors.domain([minSales, maxSales]).nice()
			// 更新颜色
			d3.select("#map").selectAll("path")
				.transition()
				.duration(500)
				.ease(d3.easeLinear)
				.style('fill', state => {
					// 找到对应州
					var stateData = currentData.filter((e) => e.key == state.properties.name)
					// 无数据灰色
					if (stateData.length == 0) {
						return '#888'
					}
					// 有数据绑定
					stateData = stateData[0].value
					state.properties.profit = stateData.profit
					state.properties.sales = stateData.sales
					// 数值转颜色
					if (this.currentType == 'profit') {
						return profitColors(
							stateData.profit > 0 ?
								stateData.profit / this.maxProfit :
								-stateData.profit / this.minProfit)
					} else {
						return salesColors(stateData.sales)
					}
				})

			this.drawLegend()
		},
		// 应用载入时加载数据
		initData() {
			this.years = d3.map(this.csvData, x => x['OrderYear']).keys().sort()
			this.categories = d3.map(this.csvData, x => x['ProductCategory']).keys().sort()
			this.subcategories = d3.map(this.csvData, x => x['ProductSubCategory']).keys().sort()
			this.currentType = 'profit'
			this.currentYear = 'All'
		},
		// 筛选当前的数据
		csvDataThisYear() {
			if (this.currentYear == "All") {
				return this.csvData
			} else {
				return d3.nest()
					.key(e => e['OrderYear'])
					.entries(this.csvData)
					.filter(e => e.key == this.currentYear)[0].values
			}
		},
		// 设置年份，更新图表
		setYear(year) {
			this.currentYear = year
			d3.select('#years-group').selectAll('.el-button').attr('class', 'el-button el-button--default')
			d3.select("#button-" + year).attr('class', 'el-button el-button--primary')
			this.updateMap()
			if (this.currentState != null) {
				this.drawLineChart()
				this.drawBarChart()
				this.drawPieChart()
			}
		},
		// 播放年份
		playYear() {
			var year_idx = 0;
			year_interval = setInterval(() => {
				if (year_idx == this.years.length) {
					this.setYear('All')
				} else if (year_idx < this.years.length) {
					this.setYear(this.years[year_idx])
				} else {
					clearInterval(year_interval);
				}
				year_idx++;
			}, 1000);
		},
		// 设置地图类型
		setType(t) {
			this.currentType = t
			this.updateMap()
			if (this.currentState != null) {
				this.drawLineChart()
				this.drawBarChart()
				this.drawPieChart()
			}
		},
		// 选中州
		setState(s) {
			this.currentState = s
			d3.selectAll('path')
				.attr("stroke", "white")
				.attr("stroke-width", "1")
			d3.select('#path-' + s)
				.attr("stroke", "orange")
				.attr("stroke-width", "5")
			this.drawBarChart()
			this.drawPieChart()
			this.drawLineChart()
		},
		// 绘制比例尺
		drawLegend() {
			// 清空
			d3.select('#legend').text("")

			// 设置外部宽度
			var legend = d3.select('#legend')
				.append('ul')
				.attr('class', 'key')
				.style('width', '30px')
			// 使用比例尺的值域作为比例尺颜色值
			if (this.currentType == 'profit') {
				legend
					.selectAll('li.key')
					.data(profitColors.range().reverse())
					.enter().append('li')
					.attr('class', 'key')
					.style('border-left-color', String)
					.text(color => {
						var range = profitColors.invertExtent(color)
						var value = range[0] * (range[0] < 0 ? -this.minProfit : this.maxProfit)
						return floorMoney(value)
					})
			} else {
				legend.selectAll('li.key')
					.data(salesColors.range().reverse())
					.enter().append('li')
					.attr('class', 'key')
					.style('border-left-color', String)
					.style('width', "30px")
					.text(color => {
						var range = salesColors.invertExtent(color)
						return floorMoney(range[0])
					})
			}
		},
		// 绘制条形图
		drawBarChart() {
			// 聚合函数
			function aggBar(groups) {
				var sales = 0.0;
				var profit = 0.0;
				groups.forEach(e => {
					profit += +e['Profit']
					sales += +e['Sales']
				});
				return {
					'profit': profit,
					'sales': sales
				}
			}
			// 数据聚合
			var currentData = d3.nest()
				.key(e => e['State'])
				.rollup(this.aggMap)
				.entries(this.csvDataThisYear())
				.filter((e) => e.key == this.currentState)
			// 数据整理
			var row = ["x"]
			var col = ["profit"]
			if (currentData.length > 0) {
				currentData = d3.nest()
					.key(e => e['ProductSubCategory'])
					.rollup(aggBar)
					.entries(currentData[0].values)
					.sort(function (a, b) {
						return b.value.profit - a.value.profit
					})

				currentData.forEach(e => {
					row.push(e.key)
					col.push(e.value.profit)
				})
			}
			// 绘制条形图
			var barChart = bb.generate({
				title: {
					text: this.currentYear + " products profit of " + this.currentState
				},
				data: {
					columns: [
						row,
						col
					],
					x: 'x',
					groups: [
						['profit']
					],
					color: (color, d) => {
						c = profitColors(
							d.value > 0 ?
								d.value / this.maxProfit :
								-d.value / this.minProfit)
						return c
					},
					//order: "desc",
					type: "bar"
				},
				axis: {
					x: {
						type: "category",
						tick: {
							text: {
								show: true
							}
						}

					},
				},
				legend: {
					show: false
				},
				bindto: "#bar-chart"
			});
		},
		// 绘制饼图
		drawPieChart() {
			// 聚合函数
			function aggBar(groups) {
				var sales = 0.0;
				var profit = 0.0;
				groups.forEach(e => {
					profit += +e['Profit']
					sales += +e['Sales']
				});
				return {
					'profit': profit,
					'sales': sales
				}
			}
			// 数据聚合
			var currentData = d3.nest()
				.key(e => e['State'])
				.rollup(this.aggMap)
				.entries(this.csvDataThisYear())
				.filter((e) => e.key == this.currentState)
			// 数据整理
			var cols = []
			if (currentData.length > 0) {
				currentData = d3.nest()
					.key(e => e['ProductSubCategory'])
					.rollup(aggBar)
					.entries(currentData[0].values)
					.sort(function (a, b) {
						return b.value.profit - a.value.profit
					})

				currentData.forEach(e => {
					cols.push([e.key, e.value.sales])
				})
			}
			// 绘制饼图
			var pieChart = bb.generate({
				title: {
					text: this.currentYear + " product sales % of " + this.currentState
				},
				data: {
					columns: cols,
					//order: "desc",
					type: "pie",
					color: (color, d) => {
						var v = null
						if (typeof d == "object") {
							v = currentData.find(e => e.key == d.id).value.profit

						} else {
							v = currentData.find(e => e.key == d).value.profit
						}
						return profitColors(
							v > 0 ?
								v / this.maxProfit :
								-v / this.minProfit)
					}
				},
				legend: {
					show: true
				},
				bindto: "#pie-chart"
			});
			d3.select("#pie-chart").selectAll(".bb-legend-item")
				.on("click", null)
		},
		// 绘制折线图
		drawLineChart() {
			// 聚合函数
			function aggBar(groups) {
				var sales = 0.0;
				var profit = 0.0;
				groups.forEach(e => {
					profit += +e['Profit']
					sales += +e['Sales']
				});
				return {
					'profit': profit,
					'sales': sales
				}
			}
			// 数据聚合
			var currentData = d3.nest()
				.key(e => e['State'])
				.rollup(this.aggMap)
				.entries(this.csvDataThisYear())
				.filter((e) => e.key == this.currentState)
			// 数据整理
			var m = ['x', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
			var profit = new Array(13)
			profit.fill(0)
			profit[0] = "profit"
			var sales = new Array(13)
			sales.fill(0)
			sales[0] = "sales"
			if (currentData.length > 0) {
				currentData = d3.nest()
					.key(e => e['OrderMonth'])
					.rollup(aggBar)
					.entries(currentData[0].values)
					.sort(function (a, b) {
						return b.value.profit - a.value.profit
					})
				console.log(currentData)
				currentData.forEach(e => {
					//row.push(e.key)
					profit[e.key] = e.value.profit
					sales[e.key] = e.value.sales
				})
			}
			// 绘制折线图
			var lineChart = bb.generate({
				title: {
					text: this.currentYear + " month sales/profit of " + this.currentState
				},
				data: {
					columns: [
						m,
						sales,
						profit
					],
					x: 'x',
					axes: {
						sales: "y",
						profit: "y"
					}
				},
				axis: {
					x: {
						tick: {
							count: 12,
							culling: false
						}
					}
				},
				bindto: "#line-chart"
			});

		},
	}

})