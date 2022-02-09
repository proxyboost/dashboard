window.Dash = {}

Dash.$el = {}

Dash.httpHeaders = {
  'Accept': 'application/json',
}

Dash.htmlHeader = {
  fetchIP() {
    const url = 'https://pve.example.net/ip.json'
    fetch(url, { headers: Dash.httpHeaders })
      .then(res => res.json())
      .then(({ ip }) => document.getElementById('ip').innerHTML = ip)
  },
}

Dash.gotify = {
  formatList(str, separator = ' ') {
    let isTrunc = false
    const arr = str.split(separator)
    while (arr.reduce((acc, cur) => acc + ', ' + cur, '').length > 85) {
      arr.pop()
      isTrunc = true
    }
    return arr.join(', ').trimEnd() + (isTrunc ? '...' : '')
  },
  
  getTitle({ title, message }) {
    if (title.startsWith('jellyfin')) {
      title = title.replace(' has been added to your media library', '')
    }
    else if (title.includes('Unattended Upgrades') && !title.includes(' is ')) {
      const num = (message.match(/,/g) || '').length + 1
      title = title.replace('Unattended Upgrades', `Upgraded ${num} packages`)
    }
    else if (title.startsWith('tinypilot: UPS')) {
      title = `tinypilot: ${message}`
    }
    else if (title.startsWith('Uptime-Kuma')) {
      title = `uptime: ${message.replace(/(\[http.*\])/, '')}`
    }
    else if (title.includes('Trivy')) {
      title = title.replace('critically ', '')
    }
    else if (title.startsWith('Cron <')) {
      title = title.split(' ')[1].match(/<.+@(.+)>/)[1] + ': Cron job failed'
    }
    else if (title.startsWith('vzdump')) {
      title = title
        .replace('vzdump backup status (pve.example.net) :', 'pve:')
        .replace('(vzdump backup tool <root@pve.example.net>)', '')
        .replace(': b', ': B')
    }
    else if (title.startsWith('Sync remote')) {
      title = title
        .replace(/Sync remote '(.*)' datastore '(.*)' successful \(.*\)/, `pbs-rem: Sync\'d datastore $2 from $1`)
    }
    if (title.length > 85) {
      title = title.substring(0, 85) + '...'
    }
    let service
    const splitStr = title.split(':')
    if (splitStr.length > 1) {
      service = splitStr[0]
      title = splitStr.slice(1, splitStr.length).join(' -')
    }
    return { service, title }
  },

  getMessage({ title, message }) {
    if (title.startsWith('jellyfin:')
      || title.includes('front door')
      || message.includes('driveway')
      || title.startsWith('tinypilot: UPS')
      || title.endsWith('is DOWN')
      || title.endsWith('is UP')
      || title.startsWith('Uptime-Kuma')
      || (title.startsWith('Sync remote') && title.includes('successful'))) {
      message = ''
    }
    else if (title.startsWith('ouroboros:') || title.includes('Trivy')) {
      message = this.formatList(message, ', ')
    }
    else if (title.includes('Unattended Upgrades')) {
      message = this.formatList(message.replace(/(:armhf)?\s\(.*\)\s\.\.\.\s+/g, ' '), ', ')
    }
    else if (title.startsWith('Cron <') && message.length > 85) {
      message = message.substring(0, 85) + '...'
    }
    else if (title.startsWith('vzdump')) {
      message = message.match(/<tr>(.*)<\/tr>/g)
        .map(m => m.replace(/<.*?>/g, ' ').replace(/vm\/\d\d\d\/20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ/, '').trim())
        .slice(1)
        .join('<br>')
    }
    return message
  },

  formatMessages({ messages }) {
    const today = new Date().getDate()
    return messages.reduce((acc, cur) => {
      const { service, title } = Dash.gotify.getTitle(cur)
      const message = Dash.gotify.getMessage(cur)
      const href = service === 'jellyfin' ? cur.message.match(/https:\/\/.+\)/g)[1].slice(0, -1) : '#'
      const day = parseInt(cur.date.split('-')[2].substring(0, 2))
      let date = cur.date.split('.')[0].slice(0, -3).replace('T', ' ')
      if (day === today) {
        date = 'Today at ' + date.split(' ')[1]
      } else if (day === today - 1) {
        date = 'Yesterday at ' + date.split(' ')[1]
      }
      const icon = service ? ((service === 'pve' || service.startsWith('pbs')) ? 'proxmox' : service.endsWith('vm') ? 'debian' : (service || 'gotify')) : 'gotify'
      return acc += `
        <a id="${cur.id}" href="${href}" style="display: grid; grid-template-columns: 20px 1fr; grid-column-gap: 4px; align-items: baseline; line-height: 1.4; margin-bottom: 4px">
          <img src="icons/${icon}.png" style="margin-top: 2px">
          <div>
            <div>
              <span>${service ? `<b>${service}:</b>` : ''}</span>
              <span>${title ? `${title}` : ''}</span>
            </div>
            <div>${message ? `${message}` : ''}</div>
            <div style="margin-top: 4px"><i>${date}</i></div>
          </div>
          <button onclick="return Dash.gotify.deleteMessage(${cur.id})">✕</button>
        </a>`
    }, '')
  },

  deleteMessage(id) {
    const url = `https://gotify.example.net/message/${id}`
    const headers = { ...Dash.httpHeaders, 'X-Gotify-Key': 'gotifyClientKey' }
    fetch(url, { headers, method: 'DELETE' })
      .then(res => {
        if (res.ok) document.getElementById(id).remove()
      })
    return false
  },

  fetchData() {
    const url = 'https://gotify.example.net/message?limit=5'
    const headers = { ...Dash.httpHeaders, 'X-Gotify-Key': 'gotifyClientKey' }
    fetch(url, { headers })
      .then(res => res.json())
      .then(this.formatMessages)
      .then(html => document.getElementById('gotify').innerHTML = `<h3>Notifications</h3>${html}`)
  },
}

Dash.hass = {
  entities: {
    'sensor.pve_cpu_temp': {
      compare: '>=',
      state: 70,
      href: 'https://pve.example.net/temperatures.json',
    },
    'sensor.uv_index': {
      compare: '>=',
      state: 6,
      href: 'https://outside.example.net',
    },
    'switch.front_door_detect': {
      compare: '==',
      state: 'off',
      href: 'https://hass.example.net/lovelace-cameras/live',
    },
    'sensor.oneplus_battery_level': {
      compare: '<=',
      state: '20',
      href: '',
    },
    'sensor.current_power_importing': {
      compare: '>=',
      state: 1000,
      href: 'https://envoy.example.net',
    },
    'binary_sensor.shellydw2_aa8268_door': {
      compare: '==',
      state: 'on',
      href: 'https://hass.example.net/lovelace-home/doors',
    },
  },

  alerts: [],

  fetchData() {
    const url = 'https://hass.example.net/api/states'
    fetch(url, {
      headers: {
        ...Dash.httpHeaders,
        'Authorization': 'Bearer hassLongLivedToken',
      },
    })
      .then(res => res.json())
      .then(data => {
        Dash.hassData = data
        let html = ''
        data.forEach(({ entity_id, state, last_updated, attributes: { entity_picture, friendly_name, unit_of_measurement } }) => {
          const entity = this.entities[entity_id]
          if (entity) {
            if (
              (entity.compare === '==' && state == entity.state) ||
              (entity.compare === '>=' && state >= entity.state) ||
              (entity.compare === '<=' && state <= entity.state) ||
              (entity.compare === '!=' && state != entity.state)
            ) {
              const value = typeof entity.state === 'number' ? Math.round(parseFloat(state)) : state
              html += `<a href="${entity.href}">${friendly_name}:&nbsp;<span style="color: #B44">${value}${unit_of_measurement || ''}</span></a>`
            }
          // last_updated is not the time of last detection
          } else if (false && entity_id.startsWith('camera.') && (entity_id.endsWith('_person') || entity_id.endsWith('_car'))) {
            const detectionTimestamp = Date.parse(last_updated)
            const nowTimestamp = Date.parse(new Date())
            if ((nowTimestamp - detectionTimestamp) < 60000) {
              html += `<a href="https://hass.example.net${entity_picture}">Detected ${friendly_name}</a>`
            }  
          }
        })
        if (!html.length) html = '<a>Everything is OK lang!</a>'
        html = '<h3>Real-time Alerts</h3>' + html
        document.getElementById('alerts').innerHTML = html
      })
  }
}

Dash.healthchecks = {
  fetchData() {
    const url = 'https://healthchecks.example.net/api/v1/checks/?tag=heartbeat'
    fetch(url, { headers: { ...Dash.httpHeaders, 'X-Api-Key': 'healthchecksApiKey' } })
      .then(res => res.json())
      .then(data => {
        data.checks.forEach(({ tags, status }) => {
          const tag = tags.split(' ')[0]
          if (!Dash.$el[tag]) Dash.$el[tag] = document.getElementById(tag)
          if (Dash.$el[tag].dataset.status !== status) {
            Dash.$el[tag].dataset.status = status
          }
        })
      })
  }
}

Dash.fetchAllData = () => {
  Dash.htmlHeader.fetchIP()
  Dash.healthchecks.fetchData()
  Dash.hass.fetchData()
  Dash.gotify.fetchData()
}

Dash.setFetchInterval = () => {
  Dash.fetchInterval = setInterval(Dash.fetchAllData, 10000)
}

Dash.fetchAllData()
Dash.setFetchInterval()

document.addEventListener('visibilitychange', () => {
  console.info('visibilitychange - hidden:', document.hidden)
  if (document.hidden) {
    clearInterval(Dash.fetchInterval)
  }
  else {
    Dash.fetchAllData()
    Dash.setFetchInterval()
  }
})

Dash.setPopup = (name, fn) => {
  if (!Dash.$el[name]) Dash.$el[name] = document.getElementById(name)
  let timeout
  Dash.$el[name].addEventListener('mouseenter', () => {
    timeout = setTimeout(fn, 500)
  })
  Dash.$el[name].addEventListener('mouseleave', () => {
    Dash.$el[name].classList.remove('show-popup')
    clearTimeout(timeout)
  })
}

Dash.setPopup('pihole', () => {
  const piholeData = Dash.hassData.find(obj => obj.entity_id === 'sensor.pi_hole_ads_percentage_blocked_today')
  Dash.$el.pihole.querySelector('.popup').innerHTML = `Blocked: ${Math.round(piholeData.state)}${piholeData.attributes.unit_of_measurement}`
  Dash.$el.pihole.classList.add('show-popup')
})

Dash.setPopup('traefik-lan', () => {
  const url = 'https://traefik-lan.example.net/api/overview'
  fetch(url, { headers: { ...Dash.httpHeaders, Authorization: 'Basic encodedCredentials' } })
    .then(res => res.json())
    .then(({ http: { routers, middlewares, services } }) => {
      Dash.$el['traefik-lan'].querySelector('.popup').innerHTML = `
        <div>HTTP</div>
        <div>Routers: ${routers.errors ? `${routers.errors} errors` : routers.warnings ? `${routers.warnings} warnings` : `${routers.total} total`}</div>
        <div>Middlewares: ${middlewares.errors ? `${middlewares.errors} errors` : middlewares.warnings ? `${middlewares.warnings} warnings` : `${middlewares.total} total`}</div>
        <div>Services: ${services.errors ? `${services.errors} errors` : services.warnings ? `${services.warnings} warnings` : `${services.total} total`}</div>
      `
      Dash.$el['traefik-lan'].classList.add('show-popup')
    })
})

Dash.setPopup('envoy', () => {
  const productionData = Dash.hassData.find(obj => obj.entity_id === 'sensor.envoy_current_power_production')
  const consumptionData = Dash.hassData.find(obj => obj.entity_id === 'sensor.envoy_current_power_consumption')
  Dash.$el.envoy.querySelector('.popup').innerHTML = `
    <div>Production: ${Math.max(0, productionData.state)}${productionData.attributes.unit_of_measurement}</div>
    <div>Consumption: ${Math.max(0, consumptionData.state)}${consumptionData.attributes.unit_of_measurement}</div>
  `  
  Dash.$el.envoy.classList.add('show-popup')
})

Dash.setPopup('outside', () => {
  const url = 'https://outside.example.net/data.json'
  fetch(url, { headers: Dash.httpHeaders })
    .then(res => res.json())
    .then(data => {
      let html = ''
      data.forEach(({ title, value }) => {
        html += `<div>${title}: ${Math.round(value)}</div>`
      })
      Dash.$el.outside.querySelector('.popup').innerHTML = html
      Dash.$el.outside.classList.add('show-popup')
    })
})

Dash.setPopup('pihole-rem', () => {
  const url = 'https://pihole-rem.example.net/admin/api.php'
  fetch(url, { headers: Dash.httpHeaders })
    .then(res => res.json())
    .then(data => {
      Dash.$el['pihole-rem'].querySelector('.popup').innerHTML = `Blocked: ${Math.round(data.ads_percentage_today)}%`
      Dash.$el['pihole-rem'].classList.add('show-popup')
    })
})