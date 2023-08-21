import { Component } from 'react'
import * as d3 from 'd3'
import data from './data.json'
import './App.css'

export default class App extends Component {
  i = 0

  componentDidMount () {
    if (this.i++ === 0) {
      this.drawChart()
    }
  }

  drawChart () {
    // 画布大小
    const SVG_WIDTH = 900
    const SVG_HEIGHT = 500
    // 颜色系列
    const color = d3.scaleOrdinal(d3.schemeCategory10)
    let mouseX
    let mouseY
    let clock

    // 在一个圆盘中随机生成初始坐标
    let initialX; let initialY; const initialSize = 50.0
    for (const i in data.nodes) {
      initialX = SVG_WIDTH * 0.5
      initialY = SVG_HEIGHT * 0.5
      data.nodes[i].x = initialX + initialSize * (Math.random() - 0.5) * Math.cos(2 * 3.14 * Math.random())
      data.nodes[i].y = initialY + initialSize * (Math.random() - 0.5) * Math.sin(2 * 3.14 * Math.random())
    }

    // 获取画布
    const svg = d3.select('svg')
      .attr('width', SVG_WIDTH)
      .attr('height', SVG_HEIGHT)
      .attr('viewBox', [0, 0, SVG_WIDTH, SVG_HEIGHT])
      .attr('style', 'max-width: 100%; height: 100%;')

    // 初次修正并渲染
    changeMapData(data.links, data.nodes, 1000, 0.5, 0.3)

    // 渲染svg
    function renderMap (links, nodes) {
      d3.selectAll('svg > *').remove()

      // 渲染links
      svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .selectAll()
        .data(links)
        .join('line')
        .attr('x1', d => {
          let key
          nodes.map((obj) => {
            if (d.source === obj.id) {
              key = obj.x
            }
            return null
          })
          return key
        })
        .attr('y1', d => {
          let key
          nodes.map((obj) => {
            if (d.source === obj.id) {
              key = obj.y
            }
            return null
          })
          return key
        })
        .attr('x2', d => {
          let key
          nodes.map((obj) => {
            if (d.target === obj.id) {
              key = obj.x
            }
            return null
          })
          return key
        })
        .attr('y2', d => {
          let key
          nodes.map((obj) => {
            if (d.target === obj.id) {
              key = obj.y
            }
            return null
          })
          return key
        })
        .attr('stroke-width', d => Math.sqrt(d.value))

      // 渲染nodes
      svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll()
        .data(nodes)
        .join('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 5)
        .call(
          d3.drag()
            .on('drag', dragged)
            .on('end', () => {
              window.clearInterval(clock)
              changeMapData(data.links, data.nodes, 300, 1, 0.5)
            })
        )
        .attr('fill', d => color(d.group))
        .append('title')
        .text(d => d.id)
    }

    // 进行未处于拖拽过程时的迭代修正
    function changeMapData (linkList, nodeList, times, maxX, maxY) {
      let int = setInterval(onePage, 0.02)
      let i = 0
      // 画出迭代动画中的一页
      function onePage () {
        const changedMap = changeOnce(linkList, nodeList, maxX, maxY)
        linkList = changedMap.linkList
        nodeList = changedMap.nodeList
        renderMap(linkList, nodeList)
        if (i++ === times) {
          int = window.clearInterval(int)
        }
      }
    }

    // 拖拽过程中的数据更新
    function dragged (event) {
      if (event.x !== mouseX || event.y !== mouseY) {
        window.clearInterval(clock)
      }
      console.log(event)
      data.nodes.map((node) => {
        if (node.id === event.subject.id) {
          node.x = event.x - 370
          node.y = event.y - 120
        }
        return null
      })

      clock = setInterval(dragging, 0.2)

      function dragging () {
        changeOnce(data.links, data.nodes, 1, 0.5)

        data.nodes.map((node) => {
          if (node.id === event.subject.id) {
            node.x = event.x - 340
            node.y = event.y - 90
          }
          return null
        })

        renderMap(data.links, data.nodes)
      }
    }

    // 修正并更新一次数据
    function changeOnce (linkList, nodeList, maxX, maxY) {
      const xMap = {}
      const yMap = {}
      const nodeMap = {}
      let k

      // 计算理想k值
      if (nodeList && linkList) {
        k = Math.sqrt(SVG_WIDTH * SVG_HEIGHT / nodeList.length)
      }

      // 初始化nodeMap坐标集
      for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i]
        if (node) {
          nodeMap[node.id] = node
        }
      }

      calculateRepulsive()
      calculateTraction()
      calculateCenter()
      updateMap(maxX, maxY)

      // 仿电荷斥力(输入点及其坐标，Map中记录距离变化量)
      function calculateRepulsive () {
        let ejectFactor = 350
        let distX, distY, dist
        for (let i = 0; i < nodeList.length; i++) {
          xMap[nodeList[i].id] = 0.0
          yMap[nodeList[i].id] = 0.0
          for (let j = 0; j < nodeList.length; j++) {
            if (i !== j) {
              distX = nodeList[i].x - nodeList[j].x
              distY = nodeList[i].y - nodeList[j].y
              dist = Math.sqrt(distX * distX + distY * distY)
            }
            if (dist < 30 && dist >= 15) {
              ejectFactor = 200
            } else if (dist < 15) {
              ejectFactor = 500
            }
            if (dist > 0 && dist < 300) {
              const id = nodeList[i].id
              xMap[id] = xMap[id] + distX * k * k * ejectFactor / dist / dist
              yMap[id] = yMap[id] + distY * k * k * ejectFactor / dist / dist
            }
          }
        }
      }

      // 仿弹簧引力(输入点及其坐标，Map中记录距离变化量)
      function calculateTraction () {
        let condenseFactor = 3000
        let startNode, endNode
        for (let i = 0; i < linkList.length; i++) {
          const startID = linkList[i].source
          const endID = linkList[i].target

          startNode = nodeMap[startID]
          endNode = nodeMap[endID]
          const distX = startNode.x - endNode.x
          const distY = startNode.y - endNode.y
          const dist = Math.sqrt(distX * distX + distY * distY)
          if (dist < 15) {
            condenseFactor = 1000
          }
          xMap[startID] = xMap[startID] - distX * dist * condenseFactor / k
          yMap[startID] = yMap[startID] - distY * dist * condenseFactor / k
          xMap[endID] = xMap[endID] + distX * dist * condenseFactor / k
          yMap[endID] = yMap[endID] + distY * dist * condenseFactor / k
        }
      }

      // 固定圆中心力
      function calculateCenter () {
        const centerFactor = 1200
        let distX, distY, dist
        for (let i = 0; i < nodeList.length; i++) {
          distX = nodeList[i].x - SVG_WIDTH / 2
          distY = nodeList[i].y - SVG_HEIGHT / 2
          dist = Math.sqrt(distX * distX + distY * distY)
          if (dist > 400) {
            const id = nodeList[i].id
            xMap[id] = xMap[id] - k * distX * dist * dist / centerFactor / 2
            yMap[id] = yMap[id] - k * distY * dist * dist / centerFactor / 2
          } else if (dist > 20) {
            const id = nodeList[i].id
            xMap[id] = xMap[id] - k * distX * dist * dist / centerFactor / 3
            yMap[id] = yMap[id] - k * distY * dist * dist / centerFactor / 3
          }
        }
      }

      // 更新数据(输入Map,nodeList中的x,y发生改变)
      function updateMap (maxX, maxY) {
        const maxDx = maxX; const maxDy = maxY // Additional coefficients.
        for (let i = 0; i < nodeList.length; i++) {
          const node = nodeList[i]
          let dx = Math.floor(xMap[node.id])
          let dy = Math.floor(yMap[node.id])

          if (dx < -maxDx) dx = -maxDx
          if (dx > maxDx) dx = maxDx
          if (dy < -maxDy) dy = -maxDy
          if (dy > maxDy) dy = maxDy
          node.x = node.x + dx >= SVG_WIDTH || node.x + dx <= 0 ? node.x - dx : node.x + dx
          node.y = node.y + dy >= SVG_HEIGHT || node.y + dy <= 0 ? node.y - dy : node.y + dy
          if (node.x <= 0) node.x = 0
          if (node.y <= 0) node.y = 0
          if (node.x >= SVG_WIDTH) node.x = SVG_WIDTH
          if (node.y >= SVG_HEIGHT) node.y = SVG_HEIGHT
        }
      }

      data.linkList = linkList
      data.nodes = nodeList
      return { linkList, nodeList }
    }
  }

  render () {
    return <div className="background"><svg/></div>
  }
}
